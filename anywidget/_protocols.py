from typing_extensions import TypedDict, Literal


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
    msg_id: str
    msg_type: str
    parent_header: dict
    metadata: dict
    content: JupyterWidgetContent
    buffers: list[memoryview]
