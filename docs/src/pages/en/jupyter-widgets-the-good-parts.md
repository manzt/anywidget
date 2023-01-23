---
title: "Jupyter Widgets: The Good Parts"
layout: ../../layouts/MainLayout.astro
---

_This section is largely adapted from
["Building a Custom Widget"](https://ipywidgets.readthedocs.io/en/8.0.2/examples/Widget%20Custom.html)
in the Jupyter Widgets documentation. I'd hoped to avoid separately documenting
the Jupyter Widgets API, but their tutorial mixes boilerplate/packaging details
with essential Jupyter Widget - and therefore **anywidget** - "concepts"_

## The Widget Front End

This section is intended to contextualize the Jupyter Widget documentation
for the **anywidget** developer. Remember that **anywidget** is just abstraction
over traditional Jupyter Widgets that removes boilerplate and packaging details.

### Comparison with traditional Jupyter Widgets

**anywidget** primarily simplies creating your widget's front-end code. The only requirement
is that the JavaScript you write is valid ESM and exports a function called `render`.
**anywidget's** `render` function just an alias for the traditional
[`DOMWidgetView.render`](https://ipywidgets.readthedocs.io/en/8.0.2/examples/Widget%20Custom.html#Render-method) method,
except that your Widget's view is passed as the first argument.

Concretely, custom widgets are traditionally defined like:

```javascript
import { DOMWidgetModel, DOMWidgetView } from "@jupyter-widgets/base";

// All boilerplate, anywidget takes care of this ...
class CustomModel extends DOMWidgetModel {
	/* ... */
}

class CustomView extends DOMWidgetView {
	render() {
		let view = this;
		let el = this.el;
		let model = this.model;
		/* ... */
	}
}

export { CustomModel, CustomView };
```

... which must be transformed, bundled, and installed in multiple notebook environments.

In **anywidget**, the code above simplies to:

```javascript
/** @param {DOMWidgetView} view */
export function render(view) {
	let el = this.el;
	let model = this.model;
	/* ... */
}
```

... which can easily be inlined as a Python string in many cases:

```python
class CustomWidget(anywidget.AnyWidget):
    _esm = """
    /** @param {DOMWidgetView} view */
    export function render(view) {
      let el = this.el;
      let model = this.model;
      /* ... */
    }
    """
```

### The `render` function

Just like `DOMWidgetView.render`, your widget's `render` function
is executed exactly **one per output cell** that displays the widget instance.
Therefore, `render` primarily serves two purposes:

1. Initializing content to display (i.e., create and append element(s) to `view.el`)
2. Registering event handlers to change model state and/or update the display when model state changes

## Connecting JavaScript with Python

The Jupyter Widgets framework is build on top of the IPython Comm framework (short for communication).
It's worth reading the [_Low Level Widget Explanation_](https://ipywidgets.readthedocs.io/en/8.0.2/examples/Widget%20Low%20Level.html#Low-Level-Widget-Explanation)
to understand the core of Jupyter Widget's Model, View, Controller (MVC) architecture, but in
short the Comm framework exposes to mechanisms to send/receive data to/from the frond end:

### 1. Traitlets

[`traitlets`](https://traitlets.readthedocs.io/en/stable/using_traitlets.html)
are the easiest and most flexible way to synchronize data between the
front end and Python. The `sync=True` keyword argument tells the widget
framework to handle synchronizing that value to the front end. Take the following
`CustomWidget`:

```python
class CustomWidget(anywidget.Widget):
    _esm = (pathlib.Path(__file__).parent / "index.js").read_text()
    my_value = traitlets.Int(0).tag(sync=True)
```

It defines an Integer `my_value` trait, which is synchronized with the front
end. The `render` function now has the ability to:

- **get** `my_value`

```javascript
// index.js
export function render(view) {
	let my_value = view.model.get("my_value");
}
```

- **set** `my_value`

```javascript
// index.js
export function render(view) {
	view.model.set("my_value", 42);
	view.model.save_changes(); // required to send update to Python
}
```

- **listen for changes to** `my_value`, and register event handlers (i.e.,
  execute a function any time the `my_value` changes)

```javascript
// index.js
export function render(view) {
	function on_changed() {
		let new_my_value = view.model.get("my_value");
		console.log(`The 'my_value' changed to: ${new_my_value}`);
	}
	view.model.on("change:my_value", on_changed);
}
```

> **Note**: In the snippet above, `on_changed` is called any
> time `my_value` is updated from either Python or the
> front-end code (via `view.model.set`).

An important aspect traitlets, and their first-class support in Juptyer Widgets,
is that it is easy to compose Jupyter Widgets together in Python. For example,

```python
import ipywidgets

# create a custom widget
widget = CustomWidget()

# link a slider widget with our custom widget
slider = ipywidgets.IntSlider()
ipywidgets.link((widget, "my_value"), (slider, "value"))

# log the value of `my_value` any time it changes
output = ipywidgets.Output()
@output.capture()
def handle_change(change):
    """Prints new value to `output` widget"""
    print(change.new)
widget.observe(handle_change, names=["my_value"])

ipywidgets.VBox([slider, widget, output])
```

It doesn't matter if our widget is updated from JavaScript or Python, the IPython
framework ensures it stays in sync with all the different components.

### 2. Custom messages

A second mechanism to send data to the front end is with custom messages. Within
your `render` function, you can listen to `msg:custom` events on the
`view.model`. For example,

```python
class CustomMessageWidget(anywidget.AnyWidget):
    _esm = """
    export function render(view) {
      view.model.on("msg:custom", msg => {
         console.log(`new message: ${JSON.stringify(msg)}`);
       });
    }
    """

widget = CustomMessageWidget()
widget # display the widget
```

```python
# send message
widget.send({ "type": "my-event", "foo": "bar" })

# Browser console:
# new message: '{ "type": "my-event", "foo": "bar" }'
```

<blockquote>

**Warning**: Custom messages are only received if your front-end
code has executed (i.e., the widget is displayed **before** sending messages).
Calling the snippet above out of order:

<br/>

```python
widget = CustomMessageWidget()

# send message, but no event listeners!
widget.send({ "type": "my-event", "foo": "bar" })

# displays widget (starts listening for events)
widget
```

</blockquote>

## Tips for beginners

**anywidget** is a minimal layer on top of Jupyter Widgets and
explicitly avoids inventing new concepts or widget APIs. Its design
allows widget authors to have nearly same low-level control over their
Jupyter integrations, but this low-level flexibility can be intimidating
and confusing new widget authors.

Here are some general recommendations for being productive with **anywidget**:

- Open your browser console. Widget front-end code executes directly on the
  same webpage as your notebook. You can view errors in your front-end code or
  intermediate values with `console.log`. Getting comfortable with the console will
  help demystify the front end and enable you to quickly debug your widgets.

![Jupyter notebook with the browser console open, logging "Hello from anywidget" from the custom widget](https://user-images.githubusercontent.com/24403730/213878698-6c4cdf4f-ecc0-4f91-b947-49a5847279aa.png)

- If you are using third-party dependencies (e.g., `import * as d3 from "https://esm.sh/d3"`),
  it is worth [reading more about ESM](https://hacks.mozilla.org/2018/03/es-modules-a-cartoon-deep-dive/).
  This is the core technology used by **anywidget**, and a deeper understanding will help you
  discern what is and is not standard JavaScript.

- Prefer Traitlets over custom messages for JS <> Python communication. Widget state can be
  fully recreated from traits without Python running, whereas custom messages require both
  an active Python kernel and special ordering of function calls. Write logic that treats
  your `view.model` as the source of truth (see the **anywidget**
  [Two-Way Data-Binding Example](https://anywidget.dev/blog/introducing-anywidget/#examples).
