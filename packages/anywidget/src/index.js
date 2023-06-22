import create from "./widget.js";
// @ts-expect-error -- define is a global provided by the notebook runtime.
define(["@jupyter-widgets/base"], create);
