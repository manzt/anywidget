from __future__ import annotations

import pathlib
import typing

from anywidget._file_contents import VirtualFileContents

from ._descriptor import open_comm
from ._util import try_file_contents

if typing.TYPE_CHECKING:
    import pathlib

    import comm


def send_asset_to_front_end(comm: comm.base_comm.BaseComm, contents: str) -> None:
    """Send the static asset to the front end."""
    msg = {"method": "update", "state": {"data": contents}, "buffer_paths": []}
    comm.send(data=msg, buffers=[])


class StaticAsset:
    """
    Represents a static asset (e.g. a file) for the anywidget front end.

    This class is used _internally_ to hoist static files (_esm, _css) into
    the front end such that they can be shared across widget instances. This
    implementation detail may change in the future, so this class is not
    intended for direct use in user code.
    """

    def __init__(self, data: str | pathlib.Path) -> None:
        """
        Create a static asset for the anywidget front end.

        Parameters
        ----------
        data : str or pathlib.Path
            The data to be shared with the front end.
        """
        self._comm = open_comm()
        self._file_contents = try_file_contents(data) or VirtualFileContents(str(data))
        send_asset_to_front_end(self._comm, str(self))
        self._file_contents.changed.connect(
            lambda contents: send_asset_to_front_end(self._comm, contents)
        )

    def __str__(self) -> str:
        """Return the string representation of the asset."""
        return str(self._file_contents)

    def __del__(self) -> None:
        """Close the comm when the asset is deleted."""
        self._comm.close()

    def serialize(self) -> str:
        return f"anywidget-static-asset:{self._comm.comm_id}"
