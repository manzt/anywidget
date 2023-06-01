from __future__ import annotations

import pathlib
import typing

from ._descriptor import MimeBundleDescriptor

__all__ = ["widget", "MimeBundleDescriptor"]

ModelT = typing.TypeVar("ModelT")


def widget(
    *,
    esm: str | pathlib.Path,
    css: None | str | pathlib.Path = None,
    **kwargs: typing.Any,
) -> typing.Callable[[ModelT], ModelT]:
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

    def _decorator(cls: ModelT) -> ModelT:
        setattr(cls, "_repr_mimebundle_", MimeBundleDescriptor(**kwargs))
        return cls

    return _decorator
