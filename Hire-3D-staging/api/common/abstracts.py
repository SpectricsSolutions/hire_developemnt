from __future__ import annotations

import abc

from sqlalchemy.ext.asyncio import AsyncSession


class Store(abc.ABC):
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
