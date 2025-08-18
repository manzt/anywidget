function noop() {}

function emptyElement(el) {
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function showErrorOverlay(err) {
  let ErrorOverlay = customElements.get("vite-error-overlay");
  // don't open outside vite environment
  if (!ErrorOverlay) return;
  let overlay = new ErrorOverlay(err);
  document.body.appendChild(overlay);
}

window.addEventListener("error", showErrorOverlay);
window.addEventListener("unhandledrejection", (e) =>
  showErrorOverlay(e.reason)
);

/**
 * Normalizes possible AFM inputs to an AFM object: { initialize?, render }. Accepts callables to provide closures.
 * 1) (deprecated): exported `render` and `initialize?` -> AFM object
 * 2) AFM object
 * 3) (deprecated): Callable -> callable render -> AFM object
 * 4) Callable -> AFM object
 * @param newModule the module
 * @returns normalize AFM object
 */
async function getAFM(newModule) {
  // 1) (deprecated): exported `render` and `initialize?`
  if (newModule.render) {
    console.warn(
      '[anywidget] Deprecation Warning. Direct export of a "render" is deprecated.'
    );
    return { render: newModule.render, initialize: newModule?.initialize };
  }

  // 2) AFM object: { initialize?, render }
  if (typeof newModule.default == "object") {
    if (!newModule.default.render) {
      throw new Error("[anywidget] module must export a render function.");
    }
    return {
      render: newModule.default.render,
      initialize: newModule.default?.initialize,
    };
  }

  if (!(typeof newModule.default == "function")) {
    throw new Error(
      "[anywidget] module must export a default AFM object or callable to an AFM object."
    );
  }

  const afm = await newModule.default();
  // 3) (deprecated): Callable -> callable render -> AFM object
  if (typeof afm == "function") {
    console.warn(
      "[anywidget] Deprecation Warning. Default export of a render callable is deprecated."
    );
    return { render: afm, initialize: undefined };
  }

  // 4) (deprecated): Callable -> AFM object
  if (typeof afm == "object" && afm.render) {
    return { render: afm.render, initialize: afm?.initialize };
  }

  throw new Error(
    "[anywidget] module must export a default AFM object or callable to an AFM object."
  );
}

import.meta.hot.accept("__ANYWIDGET_HMR_SRC__", async (newModule) => {
  //   import.meta.hot.data.render = await getRender(newModule);
  const afm = await getAFM(newModule);
  import.meta.hot.data.afm = afm;
  refresh();
});

async function render({ model, el }) {
  if (import.meta.hot.data.afm == null) {
    let m = await import("__ANYWIDGET_HMR_SRC__");
    import.meta.hot.data.afm = await getAFM(m);
  }
  if (import.meta.hot.data.contexts == null) {
    import.meta.hot.data.contexts = [];
  }
  import.meta.hot.data.contexts.push({ cleanup: noop, model, el });
  refresh();
}

async function refresh() {
  let afm = import.meta.hot.data.afm;
  for (let context of import.meta.hot.data.contexts) {
    try {
      await context.cleanup();
    } catch (e) {
      console.debug("[anywidget] error cleaning up previous module.", e);
      context.cleanup = noop;
    }
    context.model.off();
    emptyElement(context.el);
    afm.initialize?.({ model: context.model });
    let cleanup = await afm.render({ model: context.model, el: context.el });
    context.cleanup = cleanup ?? noop;
  }
}

export default { render };
