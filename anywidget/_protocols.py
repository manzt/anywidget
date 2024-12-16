from __future__ import annotations

from typing import TYPE_CHECKING, Any, Callable, Sequence

from typing_extensions import Literal, Protocol, TypedDict

if TYPE_CHECKING:
    from ._descriptor import MimeBundleDescriptor


class UpdateData(TypedDict):
    method: Literal["update"]
    state: dict
    buffer_paths: list[list[int | str]]


class RequestStateData(TypedDict):
    method: Literal["request_state"]


class CustomData(TypedDict):
    method: Literal["custom"]
    content: dict  # Generic[ContentT] ... but only works with TypedDict in py311


class JupyterWidgetContent(TypedDict):
    comm_id: str
    data: UpdateData | RequestStateData | CustomData


class CommMessage(TypedDict):
    header: dict
    # typically UUID, must be unique per message
    msg_id: str
    msg_type: str
    parent_header: dict
    metadata: dict
    content: JupyterWidgetContent
    buffers: list[memoryview]


class MimeReprCallable(Protocol):
    """Protocol for _repr_mimebundle_.

    https://ipython.readthedocs.io/en/stable/config/integrating.html#more-powerful-methods

    > Should return a dictionary of multiple formats, keyed by mimetype, or a tuple of
    > two dictionaries: `data`, `metadata` (see Distribution metadata). If this returns
    > something, other `_repr_*_` methods are ignored. The method should take keyword
    > arguments `include` and `exclude`, though it is not required to respect them."
    """

    def __call__(
        self,
        include: Sequence[str],
        exclude: Sequence[str],
    ) -> dict | tuple[dict, dict]: ...


class AnywidgetProtocol(Protocol):
    """Anywidget classes have a MimeBundleDescriptor at `_repr_mimebundle_`."""

    _repr_mimebundle_: MimeBundleDescriptor


class WidgetBase(Protocol):
    """Widget subclasses with a custom message reducer."""

    def send(self, msg: str | dict | list, buffers: list[bytes]) -> None: ...

    def on_msg(
        self,
        callback: Callable[[Any, str | list | dict, list[bytes]], None],
    ) -> None: ...
