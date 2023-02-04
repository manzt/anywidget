from anywidget._descriptor import anywidget, is_anywidget
from dataclasses import is_dataclass
from unittest.mock import patch
from ipykernel import comm


@patch.object(comm, "Comm", wraps=comm.Comm)
def test_descriptor_decorator(comm_cls: comm.Comm) -> None:
    @anywidget
    class Foo:
        x: int = 1

    foo = Foo()
    assert foo.x == 1

    assert is_dataclass(foo)
    comm_cls.assert_not_called()  # we haven't yet created a comm object

    assert is_anywidget(foo)
    repr_method = foo._repr_mimebundle_  # the comm is created here
    comm_cls.assert_called_once()
    assert "application/vnd.jupyter.widget-view+json" in repr_method()

    with patch.object(
        foo._repr_mimebundle_, "_comm", wraps=foo._repr_mimebundle_._comm
    ) as mock_comm:
        # test that the comm sends update messages
        foo.x = 2
        mock_comm.send.assert_called_once_with(
            data={"method": "update", "state": {"x": 2}, "buffer_paths": []}, buffers=[]
        )

        # test that the object responds to incoming messages
        mock_comm.handle_msg(
            {
                "content": {
                    "data": {
                        "method": "update",
                        "state": {"x": 3},
                    }
                }
            }
        )
        assert foo.x == 3