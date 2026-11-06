from __future__ import annotations

from typing import TYPE_CHECKING

import pytest
from anywidget import hosts
from anywidget._assets import _CACHES

if TYPE_CHECKING:
    from collections.abc import Generator


@pytest.fixture(autouse=True)
def _reset_assets() -> Generator[None]:
    """Shared assets are process state; no test should see another's."""
    yield
    _CACHES.clear()
    hosts.configure(scope=None, shared_assets=None)
