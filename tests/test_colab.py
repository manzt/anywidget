import sys
from unittest.mock import MagicMock

import IPython.display
import pytest

import anywidget


def test_enables_widget_manager_in_colab(monkeypatch: pytest.MonkeyPatch):
    mock = MagicMock()
    monkeypatch.setitem(sys.modules, "google.colab.output", mock)

    anywidget.AnyWidget()
    anywidget.AnyWidget()
    assert mock.enable_custom_widget_manager.assert_called_once


def test_ipython_display_in_colab(monkeypatch: pytest.MonkeyPatch):
    mock_display = MagicMock()
    monkeypatch.setattr(IPython.display, "display", mock_display)
    monkeypatch.setitem(sys.modules, "google.colab.output", MagicMock())

    w = anywidget.AnyWidget()

    assert hasattr(w, "_ipython_display_")
    w._ipython_display_()
    assert mock_display.assert_called_once


def test_default_no_ipython_display():
    w = anywidget.AnyWidget()
    assert not hasattr(w, "_ipython_display_")
