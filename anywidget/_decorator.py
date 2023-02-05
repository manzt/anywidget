from typing import TYPE_CHECKING, ClassVar, TypeGuard, TypeVar, Callable, Any, overload
from dataclasses import Field, field, is_dataclass, dataclass
import warnings
from .widget import DEFAULT_ESM
from ._descriptor import MimeBundleDescriptor, _REPR_ATTR
from psygnal import SignalGroup, evented

if TYPE_CHECKING:
    from ._descriptor import AnywidgetProtocol

_T = TypeVar("_T")
T = TypeVar("T", bound="type[Any]")
_ANYWIDGET_FLAG = "__anywidget_repr__"

# this preserves the signature and typing of the decorated class
# https://github.com/microsoft/pyright/blob/main/specs/dataclass_transforms.md
def __dataclass_transform__(
    *,
    eq_default: bool = True,
    order_default: bool = False,
    kw_only_default: bool = False,
    field_specifiers: tuple[type | Callable[..., Any], ...] = (()),
) -> Callable[[_T], _T]:
    return lambda a: a


@__dataclass_transform__(field_specifiers=(Field, field))
@overload
def anywidget(cls: T) -> T:
    ...


@__dataclass_transform__(field_specifiers=(Field, field))
@overload
def anywidget(
    *,
    esm: str = ...,
    follow_changes: bool = ...,
    **dataclass_kwargs: Any,
) -> Callable[[T], T]:
    ...



def is_anywidget(obj: object) -> TypeGuard[AnywidgetProtocol]:
    """Return `True` if obj is an anywidget class or an instance of an anywidget."""
    return hasattr(obj, _ANYWIDGET_FLAG)

def anywidget(
    cls: T | None = None,
    *,
    esm: str = DEFAULT_ESM,
    follow_changes: bool = True,
    **dataclass_kwargs: Any,
) -> T | Callable[[T], T]:
    """Turn class into a dataclass with an Anywidget _repr_mimebundle_ method.

    Parameters
    ----------
    cls : type, optional
        The class to decorate, by default None
    esm : str, optional
        The javascript module that will be used to create the widget
        view, by default DEFAULT_ESM
    follow_changes : bool, optional
        If True (the default), the widget view will be updated when the python model
        changes.
    **dataclass_kwargs
        Additional keyword arguments to pass to the `dataclasses.dataclass` decorator.
    """

    def _deco(cls: T) -> T:
        if dataclass_kwargs.get("frozen", False):
            raise ValueError(
                "The 'anywidget' decorator does not support dataclasses with "
                "`frozen=True`. If you need this feature, please open an issue at "
                "https://github.com/manzt/anywidget/issues."
            )

        # assign the name "_repr_mimebundle_" to the ReprBuilder descriptor
        setattr(cls, _REPR_ATTR, MimeBundleDescriptor(esm, follow_changes))

        # make sure we've got an evented dataclass
        if not is_dataclass(cls):
            cls = dataclass(cls, **dataclass_kwargs)  # type: ignore
        # TODO: check if evented already?
        cls = evented(cls)

        # set a flag so we know this is an anywidget class
        setattr(cls, _ANYWIDGET_FLAG, True)
        return cls

    return _deco(cls) if cls is not None else _deco


# Class-based form ... which provides subclassing and inheritance (unlike @guiclass)


@__dataclass_transform__(field_specifiers=(Field, field))
class AnyWidgetMeta(type):
    def __new__(cls: type, name: str, bases: tuple, attrs: dict, **kwargs) -> type:
        attrs[_ANYWIDGET_FLAG] = True
        obj: type = type.__new__(cls, name, bases, attrs)
        obj = evented(dataclass(obj))
        setattr(obj, "_repr_mimebundle_", MimeBundleDescriptor(**kwargs))
        return obj


# evented will warn "No mutable fields found in class <class '__main__.GuiClass'>"
# no events will be emitted... but it will work fine for subclasses.
with warnings.catch_warnings():
    warnings.simplefilter("ignore", category=UserWarning)

    class AnyWidget(metaclass=AnyWidgetMeta):
        _repr_mimebundle_: ClassVar[MimeBundleDescriptor]

        if TYPE_CHECKING:
            events: ClassVar[SignalGroup]

            # the mypy dataclass magic doesn't work without the literal decorator
            # it WILL work with pyright due to the __dataclass_transform__ above
            # here we just avoid a false error in mypy
            def __init__(self, *args: Any, **kwargs: Any) -> None:
                ...
