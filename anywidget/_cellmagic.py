from __future__ import annotations

import typing

from IPython.core.magic import Magics, cell_magic, line_magic, magics_class
from IPython.core.magic_arguments import argument, magic_arguments, parse_argstring

from ._file_contents import _VIRTUAL_FILES, VirtualFileContents

if typing.TYPE_CHECKING:
    from IPython.core.interactiveshell import InteractiveShell


@magics_class
class AnyWidgetMagics(Magics):
    """A set of IPython magics for working with virtual files."""

    def __init__(self, shell: InteractiveShell) -> None:
        """Initialize the magics."""
        super().__init__(shell)
        # keep a hard reference to the virtual files, _VIRTUAL_FILES is a weak dict
        self._files: dict[str, VirtualFileContents] = {}

    @magic_arguments()  # type: ignore[misc]
    @argument("file_name", type=str, help="The name of the virtual file.")  # type: ignore[misc]
    @cell_magic  # type: ignore[misc]
    def vfile(self, line: str, cell: str) -> None:
        """Create a virtual file with the contents of the cell."""
        args = parse_argstring(AnyWidgetMagics.vfile, line)
        name = f"vfile:{typing.cast(str, args.file_name)}"
        shell = typing.cast("InteractiveShell", self.shell)
        code = shell.transform_cell(cell)
        if name in self._files:
            self._files[name].contents = code
        else:
            vfile = VirtualFileContents(code)
            self._files[name] = vfile
            _VIRTUAL_FILES[name] = vfile

    @line_magic  # type: ignore[misc]
    def clear_vfiles(self, line: str) -> None:  # noqa: ARG002
        """Clear all virtual files."""
        self._files.clear()


def load_ipython_extension(ipython: InteractiveShell) -> None:
    """Load the IPython extension.

    Parameters
    ----------
    ipython : IPython.core.interactiveshell.InteractiveShell
        The IPython shell instance.
    """
    ipython.register_magics(AnyWidgetMagics)
