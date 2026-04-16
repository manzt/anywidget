/**
 * Jupyter widgets for the Deno Jupyter kernel.
 * @module
 */

import { removeBuffers } from "./utilities.ts";

let COMMS = new WeakMap<object, Comm>();
// TODO: We need to get this version from somewhere. Needs to match packages/anywidget/package.json#version
const ANYWIDGET_SEMVER_VERSION: string = "~0.9.*";

let jupyterBroadcast: Broadcast = (() => {
  try {
    return Deno.jupyter.broadcast;
  } catch {
    return async () => {};
  }
})();

let INIT_PROMISE_SYMBOL = Symbol("init_promise");

type Broadcast = (typeof Deno)["jupyter"]["broadcast"];

/** The Jupyter "mimebundle" for displaying the underlying widget. */
type Mimebundle = {
  "application/vnd.jupyter.widget-view+json": {
    version_major: number;
    version_minor: number;
    model_id: string;
  };
};

/**
 * @private
 *
 * These are internals used for testing/inspecting anywidget in Deno. DO NOT USE IN PRODUCTION.
 */
interface TestingInternals {
  /** Broadcast a message to the front end. Stubbed in testing. */
  jupyterBroadcast: Broadcast;
  /** Get the comm for a model */
  getComm(model: object): Comm;
  /** Get the init promise for a model */
  getInitPromise(model: Model<unknown>): Promise<void> | undefined;
  /** The version of anywidget used. */
  version: string;
}

/** @private */
export const _internals: TestingInternals = {
  jupyterBroadcast,
  getComm(model: object): Comm {
    let comm = COMMS.get(model);
    if (!comm) {
      throw new Error("No comm found for model");
    }
    return comm;
  },
  getInitPromise(model: Model<unknown>): Promise<void> | undefined {
    // @ts-expect-error - We have tagged this symbol onto the model privately
    return model[INIT_PROMISE_SYMBOL];
  },
  get version() {
    return ANYWIDGET_SEMVER_VERSION;
  },
};

class Comm {
  #id: string;
  #anywidgetVersion: string;
  #protocolVersionMajor: number;
  #protocolVersionMinor: number;

  constructor({ anywidgetVersion }: { anywidgetVersion?: string }) {
    this.#id = crypto.randomUUID();
    this.#anywidgetVersion = anywidgetVersion ?? ANYWIDGET_SEMVER_VERSION;
    this.#protocolVersionMajor = 2;
    this.#protocolVersionMinor = 1;
  }

  /** The id of the comm. */
  get id(): string {
    return this.#id;
  }

  /** Send a message to the front end to initialize the widget. */
  init(data: Record<string, unknown> = {}): Promise<void> {
    let { state, buffers, bufferPaths } = removeBuffers(data);
    return _internals.jupyterBroadcast(
      "comm_open",
      {
        comm_id: this.id,
        target_name: "jupyter.widget",
        data: {
          state: {
            _model_module: "anywidget",
            _model_name: "AnyModel",
            _model_module_version: this.#anywidgetVersion,
            _view_module: "anywidget",
            _view_name: "AnyView",
            _view_module_version: this.#anywidgetVersion,
            _view_count: null,
            ...state,
          },
          buffer_paths: bufferPaths,
        },
      },
      {
        buffers: buffers,
        metadata: {
          version: `${this.#protocolVersionMajor}.${this.#protocolVersionMinor}.0`,
        },
      },
    );
  }

  /** Send a state update to the front end. */
  sendState(data: Record<string, unknown>): Promise<void> {
    let { state, buffers, bufferPaths } = removeBuffers(data);
    return _internals.jupyterBroadcast(
      "comm_msg",
      {
        comm_id: this.id,
        data: {
          method: "update",
          state: state,
          buffer_paths: bufferPaths,
        },
      },
      {
        buffers: buffers,
      },
    );
  }

  /** The Jupyter "mimebundle" for displaying the underlying widget. */
  mimebundle(): Mimebundle {
    return {
      "application/vnd.jupyter.widget-view+json": {
        version_major: this.#protocolVersionMajor,
        version_minor: this.#protocolVersionMinor,
        model_id: this.id,
      },
    };
  }
}

type ChangeEvents<State> = {
  [K in string & keyof State as `change:${K}`]: State[K];
};

/** A BackboneJS-like model for the anywidget. */
export class Model<State> {
  private _state: State;
  private _target: EventTarget;

  constructor(state: State) {
    this._state = state;
    this._target = new EventTarget();
  }

  /**
   * Get a property of the state object.
   *
   * @param key - The property to get.
   */
  get<K extends keyof State>(key: K): State[K] {
    return this._state[key];
  }

  /**
   * Set a property of the state object.
   *
   * @param key - The property to set.
   * @param value - The new value.
   */
  set<K extends keyof State>(key: K, value: State[K]): void {
    this._state[key] = value;
    this._target.dispatchEvent(new CustomEvent(`change:${key as string}`, { detail: value }));
  }

  /**
   * Subscribe to changes in the state object.
   *
   * Note: Only `change:${key}` events are supported.
   *
   * @param name - The event name to subscribe to.
   * @param callback - The callback to call when the event is dispatched.
   */
  on<Event extends keyof ChangeEvents<State>>(name: Event, callback: () => void): void {
    this._target.addEventListener(name as string, callback);
  }
}

/** The front end variant of the model. */
export type FrontEndModel<State> = Model<State> & {
  /** Sync changes with the Deno kernel. */
  save_changes(): void;
};

// Requires mod user to include lib DOM in their compiler options if they want to use this type.
type HTMLElement = typeof globalThis extends {
  HTMLElement: { new (): infer T };
}
  ? T
  : unknown;

// TODO: more robust serialization of render function (with context?)
function toEsm<State>({ imports = "", render }: Pick<WidgetOptions<State>, "imports" | "render">) {
  return `${imports}\nexport default { render: ${render.toString()} }`;
}

type Awaitable<T> = T | Promise<T>;

/** The options bag to pass to the {@link widget} method. */
export interface WidgetOptions<State> {
  /** The initial widget state. */
  state: State;
  /** A function that renders the widget. This function is serialized and sent to the front end. */
  render: (context: {
    model: FrontEndModel<State>;
    el: HTMLElement;
  }) => Awaitable<(() => Awaitable<void>) | void>;
  /** The imports required for the front-end function. */
  imports?: string;
  /** The version of the anywidget front end to use. */
  version?: string;
}

/**
 * Creates an anywidget for the Deno Jupyter kernel.
 *
 * ```ts
 * import { widget } from "jsr:@anywidget/deno";
 *
 * let counter = widget({
 *   state: { value: 0 },
 *   render: ({ model, el }) => {
 *     let button = document.createElement("button");
 *     button.innerHTML = `count is ${model.get("value")}`;
 *     button.addEventListener("click", () => {
 *       model.set("value", model.get("value") + 1);
 *       model.save_changes();
 *     });
 *     model.on("change:value", () => {
 *       button.innerHTML = `count is ${model.get("value")}`;
 *     });
 *     el.appendChild(button);
 *   }
 * });
 * counter.value = 10;
 * counter; // displays the widget
 * ```
 *
 * @param options - The options for the widget {@link WidgetOptions}.
 */
export function widget<State>(options: WidgetOptions<State>): Model<State> {
  let { state, render, imports, version } = options;
  let comm = new Comm({ anywidgetVersion: version });
  let initPromise = comm.init({ ...state, _esm: toEsm({ imports, render }) });
  let model = new Model(state);
  for (let key in state) {
    // @ts-expect-error - TS can't infer this is correctly keyof ChangeEvents<State>
    model.on(`change:${key}`, () => {
      comm.sendState({ [key]: model.get(key) });
    });
  }
  let obj = new Proxy(model, {
    get(target, prop, receiver) {
      if (prop === INIT_PROMISE_SYMBOL) {
        return initPromise;
      }
      if (prop === Symbol.for("Jupyter.display")) {
        return async () => {
          await initPromise;
          return comm.mimebundle();
        };
      }
      return Reflect.get(target, prop, receiver);
    },
    has(target, prop) {
      if (prop === Symbol.for("Jupyter.display")) {
        return true;
      }
      return Reflect.has(target, prop);
    },
  });
  COMMS.set(obj, comm);
  return obj;
}
