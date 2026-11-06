"""Widget code and style assets.

Coerces the values a widget class gives for ``_esm`` and ``_css`` (inline
source, a URL, a file path, a virtual file) into a source object.
"""

from __future__ import annotations

import os
import pathlib
import re

from ._file_contents import _VIRTUAL_FILES, FileContents, VirtualFileContents

__all__ = ["_DEFAULT_ESM", "try_file_contents", "try_file_path"]

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
