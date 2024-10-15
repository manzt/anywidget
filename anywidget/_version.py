import importlib.metadata

__version__ = importlib.metadata.version("anywidget")


def get_semver_version(version: str) -> str:
    split = version.split(".", maxsplit=2)
    is_pre_release = "a" in split[2] or "b" in split[2]
    if is_pre_release:
        return ".".join(split)

    return "~" + ".".join([split[0], split[1], "*"])


_ANYWIDGET_SEMVER_VERSION = get_semver_version(__version__)
