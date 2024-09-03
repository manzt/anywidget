"""Experimental features for anywidget."""

from __future__ import annotations

import dataclasses
import typing

import psygnal

from ._descriptor import MimeBundleDescriptor

if typing.TYPE_CHECKING:  # pragma: no cover
    import pathlib

    from ._protocols import WidgetBase

__all__ = ["MimeBundleDescriptor", "dataclass", "widget"]

T = typing.TypeVar("T")


def widget(
    *,
    esm: str | pathlib.Path,
    css: None | str | pathlib.Path = None,
    **kwargs: typing.Any,  # noqa: ANN401
) -> typing.Callable[[T], T]:
    """Decorator to register a widget class as a mimebundle.

    Parameters
    ----------
    esm : str | pathlib.Path
        The path or contents of an ES Module for the widget.
    css : None | str | pathlib.Path, optional
        The path or contents of a CSS file for the widget.
    **kwargs
        Additional keyword arguments to pass to the

    Returns
    -------
    Callable
        A decorator that registers the widget class as a mimebundle.
    """
    kwargs["_esm"] = esm
    if css is not None:
        kwargs["_css"] = css

    def _decorator(cls: T) -> T:
        setattr(cls, "_repr_mimebundle_", MimeBundleDescriptor(**kwargs))  # noqa: B010
        return cls

    return _decorator


# To preserve the signature of the decorated class.
# see: https://github.com/pyapp-kit/magicgui/blob/5e068f31eaeeb130f43c38727b25423cc3ea4de3/src/magicgui/schema/_guiclass.py#L145-L162
def __dataclass_transform__(  # noqa: N807
    *,
    eq_default: bool = True,  # noqa: ARG001
    order_default: bool = False,  # noqa: ARG001
    kw_only_default: bool = False,  # noqa: ARG001
    field_specifiers: tuple[type | typing.Callable[..., object], ...] = (()),  # noqa: ARG001
) -> typing.Callable[[T], T]:
    return lambda a: a


@__dataclass_transform__(field_specifiers=(dataclasses.Field, dataclasses.field))
def dataclass(
    cls: T | None = None,
    *,
    esm: str | pathlib.Path,
    css: None | str | pathlib.Path = None,
    **dataclass_kwargs: object,
) -> typing.Callable[[T], T]:
    """Turns class into a dataclass, makes it evented, and registers it as a widget.

    Parameters
    ----------
    cls : T | None
        The class to decorate.
    esm : str | pathlib.Path
        The path or contents of an ES Module for the widget.
    css : None | str | pathlib.Path, optional
        The path or contents of a CSS file for the widget.
    dataclass_kwargs : object
        Additional keyword arguments to pass to the dataclass decorator.

    Returns
    -------
    type
        The evented dataclass.

    Examples
    --------
    >>> @dataclass(esm="index.js")
    ... class Counter:
    ...     value: int = 0
    ...
    >>> counter = Counter()
    >>> counter.value = 1
    >>> counter
    """

    def _decorator(cls: T) -> T:
        cls = dataclasses.dataclass(cls, **dataclass_kwargs)  # type: ignore[call-overload]
        cls = psygnal.evented(cls)  # type: ignore[call-overload]
        return widget(esm=esm, css=css)(cls)

    return _decorator(cls) if cls is not None else _decorator  # type: ignore[return-value]


_ANYWIDGET_COMMAND = "_anywidget_command"
_ANYWIDGET_COMMANDS = "_anywidget_commands"

_AnyWidgetCommand = typing.Callable[
    [object, object, typing.List[bytes]],
    typing.Tuple[object, typing.List[bytes]],
]


def command(cmd: T) -> T:
    """Mark a function as a command for anywidget.

    Parameters
    ----------
    cmd : Callable
        The function to mark as a command.

    Returns
    -------
    Callable
        The decorated function annotated as a command.

    """
    setattr(cmd, _ANYWIDGET_COMMAND, True)
    return cmd


def _collect_anywidget_commands(widget_cls: type) -> None:
    cmds: dict[str, _AnyWidgetCommand] = {}
    for base in widget_cls.__mro__:
        if not hasattr(base, "__dict__"):
            continue
        for name, attr in base.__dict__.items():
            if callable(attr) and getattr(attr, _ANYWIDGET_COMMAND, False):
                cmds[name] = attr  # noqa: PERF403

    setattr(widget_cls, _ANYWIDGET_COMMANDS, cmds)


def _register_anywidget_commands(widget: WidgetBase) -> None:
    """Register a custom message reducer for a widget if it implements the protocol."""
    # Only add the callback if the widget has any commands.
    cmds = typing.cast(
        "dict[str, _AnyWidgetCommand]",
        getattr(type(widget), _ANYWIDGET_COMMANDS, {}),
    )
    if not cmds:
        return

    def handle_anywidget_command(
        self: WidgetBase,
        msg: str | list | dict,
        buffers: list[bytes],
    ) -> None:
        if not isinstance(msg, dict) or msg.get("kind") != "anywidget-command":
            return
        cmd = cmds[msg["name"]]
        response, buffers = cmd(widget, msg["msg"], buffers)
        self.send(
            {
                "id": msg["id"],
                "kind": "anywidget-command-response",
                "response": response,
            },
            buffers,
        )

    widget.on_msg(handle_anywidget_command)
