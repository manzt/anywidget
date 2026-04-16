import { expect } from "@std/expect";
import * as mock from "@std/testing/mock";

import { _internals, widget } from "./src/mod.ts";
import { removeBuffers } from "./src/utilities.ts";

Deno.test("widget() initializes the front end", async () => {
  let jupyterBroadcast = mock.spy(_internals, "jupyterBroadcast");
  try {
    let model = widget({
      state: { value: 0 },
      imports: "BLAH",
      render: async ({ model: _model, el: _el }) => {},
    });
    let initPromise = _internals.getInitPromise(model);
    await initPromise;
    mock.assertSpyCalls(jupyterBroadcast, 2);
    mock.assertSpyCall(jupyterBroadcast, 0, {
      args: [
        "comm_open",
        {
          comm_id: _internals.getComm(model).id,
          target_name: "jupyter.widget",
          data: {
            state: {
              _model_module: "anywidget",
              _model_name: "AnyModel",
              _model_module_version: _internals.version,
              _view_module: "anywidget",
              _view_name: "AnyView",
              _view_module_version: _internals.version,
              _view_count: null,
            },
          },
        },
        {
          metadata: { version: "2.1.0" },
        },
      ],
    });
    mock.assertSpyCall(jupyterBroadcast, 1, {
      args: [
        "comm_msg",
        {
          comm_id: _internals.getComm(model).id,
          data: {
            buffer_paths: [],
            method: "update",
            state: {
              value: 0,
              _esm: "BLAH\nexport default { render: async ({ model, el })=>{} }",
            },
          },
        },
        {
          buffers: [],
        },
      ],
    });
  } finally {
    jupyterBroadcast.restore();
  }
});

Deno.test("model.set() sends change events to the front end", async () => {
  let jupyterBroadcast = mock.spy(_internals, "jupyterBroadcast");
  try {
    let model = widget({
      state: { value: 0 },
      render: async ({ model: _model, el: _el }) => {},
    });
    await _internals.getInitPromise(model);
    model.set("value", 1);
    mock.assertSpyCall(jupyterBroadcast, 2, {
      args: [
        "comm_msg",
        {
          comm_id: _internals.getComm(model).id,
          data: { buffer_paths: [], method: "update", state: { value: 1 } },
        },
        {
          buffers: [],
        },
      ],
    });
  } finally {
    jupyterBroadcast.restore();
  }
});

Deno.test("Explicit anywidget version overrides the default", () => {
  let jupyterBroadcast = mock.spy(_internals, "jupyterBroadcast");
  let version = "VERSION";
  let model = widget({
    state: { value: 0 },
    render: async () => {},
    version: version,
  });
  mock.assertSpyCall(jupyterBroadcast, 0, {
    args: [
      "comm_open",
      {
        comm_id: _internals.getComm(model).id,
        target_name: "jupyter.widget",
        data: {
          state: {
            _model_module: "anywidget",
            _model_name: "AnyModel",
            _model_module_version: version,
            _view_module: "anywidget",
            _view_name: "AnyView",
            _view_module_version: version,
            _view_count: null,
          },
        },
      },
      {
        metadata: { version: "2.1.0" },
      },
    ],
  });
});

Deno.test("removeBuffers extracts buffers from message", () => {
  let result = removeBuffers({
    a: new Uint8Array([1, 2, 3]),
    b: "string",
    c: new Uint8Array([4, 5, 6]),
    d: 42,
    e: {
      inner: new Uint8Array([10]),
    },
  });
  expect(result).toEqual({
    state: {
      a: null,
      b: "string",
      c: null,
      d: 42,
      e: {
        // not recursive
        inner: new Uint8Array([10]),
      },
    },
    buffers: [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])],
    bufferPaths: [["a"], ["c"]],
  });
});
