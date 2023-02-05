import collections
import unittest.mock as mock
import sys

import anywidget


def fake_module(**args):
    return collections.namedtuple("module", args.keys())(**args)


def get_patch_dict(dotted_module_path, module):
    patch_dict = {}
    module_splits = dotted_module_path.split(".")

    # Add our module to the patch dict
    patch_dict[dotted_module_path] = module

    # We add the rest of the fake modules in backwards
    while module_splits:
        # This adds the next level up into the patch dict which is a fake
        # module that points at the next level down
        patch_dict[".".join(module_splits[:-1])] = fake_module(
            **{module_splits[-1]: patch_dict[".".join(module_splits)]}
        )
        module_splits = module_splits[:-1]

    return patch_dict


def test_enables_widget_manager_in_colab():
    enable_custom_widget_manager = mock.Mock()

    with mock.patch.dict(
        sys.modules,
        get_patch_dict(
            "google.colab.output",
            fake_module(enable_custom_widget_manager=enable_custom_widget_manager),
        ),
    ):
        anywidget.AnyWidget()

        assert enable_custom_widget_manager.called


def test_adds_ipython_display_in_colab():
    enable_custom_widget_manager = mock.Mock()

    with mock.patch.dict(
        sys.modules,
        get_patch_dict(
            "google.colab.output",
            fake_module(enable_custom_widget_manager=enable_custom_widget_manager),
        ),
    ):
        w = anywidget.AnyWidget()
        assert hasattr(w, "_ipython_display_")


def test_default_no_ipython_display():
    w = anywidget.AnyWidget()
    assert not hasattr(w, "_ipython_display_")
