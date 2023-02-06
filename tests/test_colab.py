import pytest
import collections
from unittest.mock import patch, MagicMock
import sys

import anywidget

import IPython.display


def fake_module(**kwargs: dict):
    return collections.namedtuple("module", *kwargs.keys())(**kwargs)


@pytest.fixture
def mock_colab():
    enable_custom_widget_manager = MagicMock()
    mock_module = fake_module(enable_custom_widget_manager=enable_custom_widget_manager)
    with patch.dict(sys.modules, {"google.colab.output": mock_module}):
        yield mock_module


def test_enables_widget_manager_in_colab(
    mock_colab: MagicMock,
):
    anywidget.AnyWidget()
    anywidget.AnyWidget()
    assert mock_colab.enable_custom_widget_manager.assert_called_once


def test_ipython_display_in_colab(
    monkeypatch: pytest.MonkeyPatch,
    mock_colab: MagicMock,
):
    mock_display = MagicMock()
    monkeypatch.setattr(IPython.display, "display", mock_display)

    w = anywidget.AnyWidget()

    assert hasattr(w, "_ipython_display_")
    w._ipython_display_()
    assert mock_display.assert_called_once


def test_default_no_ipython_display():
    w = anywidget.AnyWidget()
    assert not hasattr(w, "_ipython_display_")
