try:
    from importlib.metadata import PackageNotFoundError, version
except ImportError:
    from importlib_metadata import (  # type: ignore[import-not-found, no-redef]
        PackageNotFoundError,
        version,
    )

try:
    __version__ = version("anywidget")
except PackageNotFoundError:
    __version__ = "uninstalled"
