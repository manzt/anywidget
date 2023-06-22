from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("anywidget")
except PackageNotFoundError:
    __version__ = "uninstalled"
