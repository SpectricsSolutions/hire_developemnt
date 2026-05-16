from __future__ import annotations

import pytest

from settings import Settings
from tests.unit.auth.helpers import make_settings, make_user


@pytest.fixture
def settings() -> Settings:
    return make_settings()


@pytest.fixture
def current_user():
    return make_user()
