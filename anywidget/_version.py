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


def get_semver_version(version: str) -> str:
    split = version.split(".", maxsplit=2)
    is_pre_release = "a" in split[2] or "b" in split[2]
    if is_pre_release:
        return ".".join(split)

    return "~" + ".".join([split[0], split[1], "*"])


_ANYWIDGET_SEMVER_VERSION = get_semver_version(__version__)
