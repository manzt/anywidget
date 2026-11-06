"""Widget code and style assets.

A widget's ``_esm`` and ``_css`` are the same for every instance of a class.
This module gives each distinct value one kernel-side model, an
:class:`ipywidgets.Widget` with a single ``contents`` trait, that front ends
resolve by id. The source then crosses the wire once per front end rather than
once per instance, and the front end can share one module evaluation across
instances.

``asset_for`` is the entry point. ``AssetTrait`` holds an asset on a widget
instance and serializes it as an asset reference (``anywidget-asset:<id>``).

An asset's comm belongs to one front end. Hosts that serve several front ends
from one process (one per session, one per virtual kernel) say which is current
through :func:`anywidget.hosts.configure`; otherwise there is one asset per
value per process.
"""

from __future__ import annotations

import os
import pathlib
import re
import weakref

import ipywidgets
import traitlets.traitlets as t

from . import hosts
from ._file_contents import _VIRTUAL_FILES, FileContents, VirtualFileContents
from ._refs import _ASSET_REF_PREFIX
from ._version import _ANYWIDGET_SEMVER_VERSION

__all__ = [
    "_DEFAULT_ESM",
    "AssetTrait",
    "asset_for",
    "try_file_contents",
    "try_file_path",
]

_DEFAULT_ESM = """
function render(view) {
  console.log("Dev note: No _esm defined for this widget:", view);
  let url = "https://anywidget.dev/en/getting-started/";
  view.el.innerHTML = `<p>
    <strong>Dev note</strong>:
    <a href='${url}' target='blank'>Implement an <code>_esm</code> attribute</a>
    on AnyWidget subclass <code>${view.model.get('_anywidget_id')}</code>
    to customize this widget.
  </p>`;
}
export default { render };
"""


def _is_hmr_enabled() -> bool:
    return os.getenv("ANYWIDGET_HMR") == "1"


def _should_start_thread(path: pathlib.Path) -> bool:
    if "site-packages" in path.parts:
        # File is inside site-packages, likely not a local development install
        return False

    if "dist-packages" in path.parts:
        # Debian-specific directory, where python packages are installed in Colab.
        return False

    # If we're in dev mode, we should start a thread to watch the file for changes.
    if not _is_hmr_enabled():
        return False

    try:
        import watchfiles  # noqa: F401, PLC0415
    except ImportError:
        import warnings  # noqa: PLC0415

        warnings.warn(
            "anywidget: Live-reloading feature is disabled."
            " To enable, please install the 'watchfiles' package.",
            stacklevel=2,
        )

        return False

    return True


def try_file_path(x: object) -> pathlib.Path | None:
    """If possible coerce x into a pathlib.Path object.

    If a string, we handle the following cases:

    - If it's a URL, return None.
    - If it's a multi-line string, return None.
    - If it's a single-line string with a file extension, return a pathlib.Path object.
    - Otherwise, return None.

    Parameters
    ----------
    x : Any
        The object to try to coerce into a pathlib.Path object.

    Returns
    -------
    pathlib.Path | None
        A pathlib.Path object if x is a file path, otherwise None.
    """
    # Already a pathlib.Path
    if isinstance(x, pathlib.Path):
        return x

    if not isinstance(x, str):
        return None

    # Handle the string

    # Ignore URLs
    if x.startswith(("http://", "https://")):
        return None

    # Ignore multi-line strings (probably raw file contents)
    is_multi_line = "\n" in x or "\r" in x
    if is_multi_line:
        return None

    # Is a single line string, but we don't know if it's a file path or raw contents.

    # Just check if it has a file extension for now.
    includes_file_suffix = re.search(r"[a-zA-Z0-9]\.[a-zA-Z0-9]+$", x) is not None
    if includes_file_suffix:
        return pathlib.Path(x).resolve().absolute()

    return None


def try_file_contents(x: object) -> FileContents | VirtualFileContents | None:
    """Try to coerce x into a FileContents object.

    Raises
    ------
    FileNotFoundError
        If the file is not found.
    """
    if isinstance(x, str) and x in _VIRTUAL_FILES:
        return _VIRTUAL_FILES[x]

    maybe_path = try_file_path(x)
    if maybe_path is None:
        return None

    path = maybe_path
    if not path.is_file():
        msg = f"File not found: {path}"
        raise FileNotFoundError(msg)
    return FileContents(
        path=path,
        start_thread=_should_start_thread(path),
    )


class _AssetModel(ipywidgets.Widget):  # type: ignore [misc]
    """One shared ``_esm`` or ``_css`` value, as a model front ends resolve by id.

    An ``ipywidgets.Widget`` rather than a bare comm so that it takes part in
    everything keyed on ``Widget._instances``: ``request_states`` on reload,
    saved widget state, ``nbconvert`` and ``ipywidgets.embed``.
    """

    _model_module = t.Unicode("anywidget").tag(sync=True)
    _model_name = t.Unicode("AnyAssetModel").tag(sync=True)
    _model_module_version = t.Unicode(_ANYWIDGET_SEMVER_VERSION).tag(sync=True)
    contents = t.Unicode("").tag(sync=True, echo_update=False)

    def __init__(self, source: FileContents | VirtualFileContents | str) -> None:
        super().__init__(contents=str(source))
        self._source = source
        if isinstance(source, (FileContents, VirtualFileContents)):
            # psygnal holds bound methods weakly; the asset is kept alive by
            # its cache entry and by `Widget._instances`.
            source.changed.connect(self._on_source_changed)

    def _on_source_changed(self, contents: str) -> None:
        self.contents = contents

    def set_state(self, sync_data: dict) -> None:
        """Apply state from a client, never its code or style."""
        super().set_state({k: v for k, v in sync_data.items() if k != "contents"})

    def close(self) -> None:
        """Close the comm and stop following the source.

        A closed asset is not reopened. The next ``asset_for`` call constructs a
        replacement through ``Widget.__init__``, so a host's construction hooks
        run for it as for any widget.
        """
        source = getattr(self, "_source", None)
        if isinstance(source, (FileContents, VirtualFileContents)):
            source.changed.disconnect(self._on_source_changed)
        super().close()

    def __str__(self) -> str:
        return self.contents


class _ProcessScope:
    """The default scope: one front end per process."""


_PROCESS_SCOPE = _ProcessScope()

# One cache per scope (`hosts.configure(scope=...)`), dropped with the scope.
# Keys are the source objects (`FileContents`, `VirtualFileContents`) or the
# source text.
_CACHES: weakref.WeakKeyDictionary[object, dict[object, _AssetModel]] = (
    weakref.WeakKeyDictionary()
)


def _cache() -> dict[object, _AssetModel]:
    scope = hosts._scope()  # noqa: SLF001
    if scope is None:
        scope = _PROCESS_SCOPE
    try:
        cache = _CACHES.get(scope)
        if cache is None:
            cache = _CACHES[scope] = {}
    except TypeError as e:
        msg = f"Asset scope must be hashable and weak-referenceable, got {scope!r}"
        raise TypeError(msg) from e
    return cache


def asset_for(value: object) -> _AssetModel:
    """Return the shared asset for a class-level ``_esm`` or ``_css`` value.

    ``FileContents`` and ``VirtualFileContents`` are keyed by identity
    (``__init_subclass__`` turns a class attribute into one such object, which
    subclasses inherit). Strings are keyed by content, so equal inline sources
    and URLs share one asset. Paths are not accepted: they are coerced when the
    class is defined, and an instance-level value stays inline (see
    ``AssetTrait``).

    One asset per value per scope (``hosts.configure``). The asset is
    created, and its comm opened, on first use. A closed asset is replaced.

    Raises
    ------
    TypeError
        If ``value`` is not a string or file-contents object.
    """
    if isinstance(value, _AssetModel):
        return value
    if not isinstance(value, (FileContents, VirtualFileContents, str)):
        msg = f"Cannot create an asset from {value!r}"
        raise TypeError(msg)
    cache = _cache()
    asset = cache.get(value)
    if asset is None or asset.comm is None:
        asset = cache[value] = _AssetModel(value)
    return asset


def _asset_to_json(value: object, _obj: object) -> object:
    if isinstance(value, _AssetModel):
        return f"{_ASSET_REF_PREFIX}{value.model_id}"
    return value


class AssetTrait(t.TraitType):
    """A trait holding a shared asset or an inline source string.

    The default is the class-level value as a shared asset. An instance-level
    override (``Widget(_esm="...")``) is this instance's alone, so it is kept
    inline rather than interned. An asset serializes as an asset reference
    (``anywidget-asset:<id>``), which the host resolves before the widget model
    is constructed; a string serializes as itself. Writes from clients are
    ignored: code and style come from the kernel only.
    """

    info_text = "a shared asset or an inline source string"

    def __init__(self, default_value: object) -> None:
        super().__init__(default_value=asset_for(default_value))
        self.metadata.setdefault("to_json", _asset_to_json)
        self.metadata.setdefault("from_json", self._from_json)
        self.metadata.setdefault("echo_update", False)

    def validate(self, obj: object, value: object) -> _AssetModel | str:
        if isinstance(value, _AssetModel):
            return value
        if isinstance(value, str):
            # Front ends read the source from the asset once the widget exists,
            # so a string assigned later would never reach them. During
            # construction the comm is not open yet and an inline override is
            # fine; see `Widget.__init__`.
            current = getattr(obj, "_trait_values", {}).get(self.name)
            if isinstance(current, _AssetModel) and getattr(obj, "comm", None):
                msg = (
                    f"The {self.name!r} trait of {obj!r} is a shared asset and "
                    "cannot be replaced with inline source after construction."
                )
                raise t.TraitError(msg)
            return value
        msg = (
            f"The {self.name!r} trait of {obj!r} expected {self.info_text}, "
            f"not {value!r}."
        )
        raise t.TraitError(msg)

    def _from_json(self, value: object, obj: object) -> _AssetModel | str:  # noqa: ARG002
        if self.name is None:
            msg = "AssetTrait.from_json called before the trait was attached to a class"
            raise RuntimeError(msg)
        return getattr(obj, self.name)
