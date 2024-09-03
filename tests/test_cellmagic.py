from anywidget._file_contents import _VIRTUAL_FILES, VirtualFileContents
from IPython.testing.globalipapp import get_ipython

maybe_ipython = get_ipython()
assert maybe_ipython is not None  # to make mypy happy
ip = maybe_ipython
ip.run_line_magic("load_ext", "anywidget")


def test_creates_virtual_file_contents() -> None:
    ip.run_cell_magic("vfile", "data.txt", "Hello, world!")
    assert "vfile:data.txt" in _VIRTUAL_FILES
    assert isinstance(_VIRTUAL_FILES["vfile:data.txt"], VirtualFileContents)
    assert str(_VIRTUAL_FILES["vfile:data.txt"]) == "Hello, world!\n"


def test_clears_vfiles() -> None:
    ip.run_cell_magic("vfile", "data.txt", "Hello,\nworld!")
    assert "vfile:data.txt" in _VIRTUAL_FILES
    ip.run_line_magic("clear_vfiles", "")
    assert "vfile:data.txt" not in _VIRTUAL_FILES
