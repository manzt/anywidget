import collections
import unittest.mock as mock
import sys

import anywidget


def fake_module(**kwargs: dict):
    return collections.namedtuple("module", *kwargs.keys())(**kwargs)


def test_enables_widget_manager_in_colab():
    fn = mock.Mock()
    fake = fake_module(enable_custom_widget_manager=fn)
    with mock.patch.dict(sys.modules, {"google.colab.output": fake}):
        anywidget.AnyWidget()
        anywidget.AnyWidget()
        assert fn.assert_called_once


def test_adds_ipython_display_in_colab():
    fake = fake_module(enable_custom_widget_manager=lambda: None)
    with mock.patch.dict(sys.modules, {"google.colab.output": fake}):
        w = anywidget.AnyWidget()
        assert hasattr(w, "_ipython_display_")


def test_default_no_ipython_display():
    w = anywidget.AnyWidget()
    assert not hasattr(w, "_ipython_display_")
