"""Host configuration.

A host is the environment anywidget runs inside: a Jupyter kernel, a Shiny
session, a marimo kernel. The host owns the channel to the front end, through
ipywidgets and ``comm``, and anywidget asks nothing about it. What anywidget
needs are the two facts that channel cannot carry: what counts as one front
end, and whether the front end resolves shared assets.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover
    from collections.abc import Callable, Hashable

__all__ = ["configure"]


class _Unset:
    """Marker for "leave this setting as it is"."""


_UNSET = _Unset()


class _Config:
    scope: Callable[[], Hashable | None] | None = None
    shared_assets: bool | None = None


_config = _Config()


def configure(
    *,
    scope: Callable[[], Hashable | None] | None | _Unset = _UNSET,
    shared_assets: bool | None | _Unset = _UNSET,
) -> None:
    """Tell anywidget what only the host knows.

    Call once, at host start-up. Arguments left out are unchanged; ``None``
    restores the default.

    Parameters
    ----------
    scope
        Returns the object that stands for "one front end" here: a Shiny
        session, a Solara virtual kernel. Shared assets are cached per scope,
        so a browser never receives a reference to an asset opened for
        another. The object must be hashable and weak-referenceable; its
        cache is dropped when it is collected. Returning ``None`` means the
        whole process. Default: one front end per process, which is right
        for a Jupyter kernel.
    shared_assets
        Whether class-level ``_esm`` and ``_css`` are sent as shared asset
        references (``anywidget-asset:<id>``, one asset model per value)
        rather than inline source. Set it when the front end resolves those
        references. Default: the ``ANYWIDGET_SHARED_ASSETS`` environment
        variable decides.
    """
    if not isinstance(scope, _Unset):
        _config.scope = scope
    if not isinstance(shared_assets, _Unset):
        _config.shared_assets = shared_assets


def _scope() -> Hashable | None:
    """The current scope, or ``None`` for the whole process."""
    return _config.scope() if _config.scope is not None else None
