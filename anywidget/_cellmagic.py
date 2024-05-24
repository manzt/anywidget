from __future__ import annotations

import typing

from IPython.core.magic import Magics, cell_magic, magics_class
from IPython.core.magic_arguments import argument, magic_arguments, parse_argstring

from ._file_contents import _VIRTUAL_FILES, VirtualFileContents

if typing.TYPE_CHECKING:
    from IPython.core.interactiveshell import InteractiveShell


@magics_class
class AnyWidgetMagics(Magics):
    @magic_arguments()
    @argument("file_name", type=str, help="The name of the virtual file.")
    @cell_magic
    def vfile(self, line, cell):
        """Create a virtual file with the contents of the cell."""
        args = parse_argstring(AnyWidgetMagics.vfile, line)
        name = typing.cast(str, args.file_name)
        shell = typing.cast("InteractiveShell", self.shell)
        code = shell.transform_cell(cell)
        if name in _VIRTUAL_FILES:
            # Update the existing VirtualFileContents object, triggering a change event
            _VIRTUAL_FILES[name].contents = code
        else:
            # Create a new VirtualFileContents object
            _VIRTUAL_FILES[name] = VirtualFileContents(code)


def load_ipython_extension(ipython: InteractiveShell):
    """Load the IPython extension.

    Parameters
    ----------
    ipython : IPython.core.interactiveshell.InteractiveShell
        The IPython shell instance.
    """
    ipython.register_magics(AnyWidgetMagics)
