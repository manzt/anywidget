---
title: Experimental Features
description: Experimental Features and APIs
layout: ../../layouts/MainLayout.astro
---

> This page describes experimental features and APIs which are subject to change
> in future releases.

## A brief overview of widgets in Jupyter

In order to understand the motivation and function of some features in the
`experimental` module, it is helpful to have a brief overview of how widgets
work in Jupyter. This is summarized below, but for a more in-depth explanation,
see the
[jupyter-widgets messaging protocol](https://github.com/jupyter-widgets/ipywidgets/blob/main/packages/schema/messages.md).

### 1. The `_repr_mimebundle_` method

When representing a python object, many front-ends REPLs,
[including IPython](https://ipython.readthedocs.io/en/stable/config/integrating.html#MyObject._repr_mimebundle_),
will look for a `_repr_mimebundle_` method on the object. If found, this method
must return a dictionary of data, keyed by
[MIME type](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types),
that can be used to render the object in the front-end. A super simple
plain-text representation of an object might look like this:

```python
class SomeDisplayableObject:
    def _repr_mimebundle_(self, **kwargs):
        return {"text/plain": repr(self)}
```

### 2. The `application/vnd.jupyter.widget-view+json` MIME type

The `application/vnd.jupyter.widget-view+json` MIME type is a special MIME type
that may be included in the `_repr_mimebundle_` in order to display a widget for
an object. In this message, the `model_id` is the comm channel id of the widget
to display.

```json
{
  "application/vnd.jupyter.widget-view+json": {
    "model_id": "some-uuid",
    ...
  }
}
```

### 3. The `Comm` object

A `comm.base_comm.BaseComm` object manages communication between the front end
(Javascript model) and the backend (Python model). When the user modifies the
state of the python object, the comm must send a message containing the updated
JSON state to the front end, so that the widget view can be update. Similarly,
when the user interacts with the widget in the browser, the front end must send
a message to the backend, so that the python model can be updated.

### Summary

In summary, we need the following to display a javascript-backed widget for a
python object:

1. A communication object to send messages between the backend python kernel and
   the frontend javascript code running in the browser.
2. A python object that has the following properties:
   - A `_repr_mimebundle_` method that returns a
     `application/vnd.jupyter.widget-view+json` MIME type with a `model_id` key
     pointing to the comm object from step 1.
   - The ability to serialize/deserialize the state of the python object to/from
     JSON.
   - An [observer pattern](https://en.wikipedia.org/wiki/Observer_pattern) that
     sends messages to the comm object when the state of the python object
     changes.
3. A javascript object that is also aware of the `model_id` and can send
   messages to the comm object when the state of the widget changes, or update
   the view when the state of the python object changes (this is provided by the
   [`@jupyter-widgets/base`](https://www.npmjs.com/package/@jupyter-widgets/base)
   package).

## MimeBundle Descriptor

In the traditional ipywidgets setup, steps 1 and 2 above are provided by the
[`ipywidgets`](https://pypi.org/project/ipywidgets/) package (with the
[`comm`](https://pypi.org/project/comm/) package providing the communication
object, and [`traitlets`](https://pypi.org/project/traitlets/) providing the
observer pattern and serialization.)

However, there are now many data-class patterns in python that one might want to
use to represent a serializeable python object (such as
[pydantic](https://pydantic-docs.helpmanual.io/),
[dataclasses](https://docs.python.org/3/library/dataclasses.html),
[msgspec](https://jcristharif.com/msgspec/), etc).

**Anywidget's `MimeBundleDescriptor` class is an experimental attempt to add the
bare minimum widget communication functionality to any python object that
implements a known data-class pattern and observer pattern (not just those that
inherit from `ipywidgets.Widget`).**:

```python
from anywidget.experimental import MimeBundleDescriptor

class Foo:
  _repr_mimebundle_ = MimeBundleDescriptor()
```

When this descriptor is accessed on an instance, it will

1. create a new `Comm` channel for this object.
2. determine what data-class pattern the object uses, and set-up serialization
   of the object currently supporting:
   - [`dataclasses.dataclass`](https://docs.python.org/3/library/dataclasses.html)
   - [`pydantic.BaseModel`](https://pydantic-docs.helpmanual.io/usage/models/)
   - [`traitlets.HasTraits`](https://traitlets.readthedocs.io/en/stable/)
   - [`msgspec.Struct`](https://jcristharif.com/msgspec/structs.html)
   - any class implementing a `_get_anywidget_state` method that returns the
     object state as a `dict`.
3. determine what observer pattern the object uses, and set-up two-way data
   binding between the object and the `comm`, currently supporting:
   - [`traitlets.HasTraits`](https://traitlets.readthedocs.io/en/stable/)
   - a
     [`psygnal.SignalGroup`](https://psygnal.readthedocs.io/en/latest/dataclasses/)
     on the object (conventionally named `events`)

## The `widget` decorator

In practice, we'd like the `MimeBundleDescriptor` to be a low-level API that
most users don't need to interact with directly. The
`anywidget.experimental.widget` decorator provides a higher-level API that can
be used to create a widget from any python object that implements a known
data-class pattern and observer.

Here's an example of how to use the `widget` decorator to create a widget from a
`dataclasses.dataclass`, that uses psygnal's
[evented-dataclass pattern](https://psygnal.readthedocs.io/en/latest/dataclasses/)
for observers:

```python
esm = "export default { render({ model, el }) {} }"
css = ".foo { color: red;}"

@widget(esm=esm, css=css)
@psygnal.evented
@dataclasses.dataclass
class Foo:
    bar: str = "baz"

foo = Foo()
```

> In the future, `@widget` may automatically add the `@psygnal.evented`
> decorator and/or the dataclass decorator if a pattern isn't automatically
> detected, but for now all must be explicitly added.
