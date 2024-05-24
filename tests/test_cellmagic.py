from anywidget._file_contents import VirtualFileContents
from IPython.testing.globalipapp import get_ipython

maybe_ipython = get_ipython()
assert maybe_ipython is not None  # to make mypy happy
ip = maybe_ipython
ip.run_line_magic("load_ext", "anywidget")


def test_creates_virtual_file_contents():
    ip.run_cell_magic("aw_file", "-n testing_123", "Hello, world!")
    assert isinstance(ip.user_ns["testing_123"], VirtualFileContents)
    assert str(ip.user_ns["testing_123"]) == "Hello, world!\n"
