from __future__ import annotations

import asyncio
from alembic import context

from common.database import Base, engine

import users.models  # noqa: F401
import auth.models  # noqa: F401
import audits.models  # noqa: F401
import clients.models  # noqa: F401
import engagements.models  # noqa: F401
import roles.models  # noqa: F401
import controls.models  # noqa: F401
import assessments.models  # noqa: F401

config = context.config
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    raise NotImplementedError("Offline migrations are not supported.")


def do_run_migrations(connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        version_table="migrations",
        compare_type=True,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    async with engine.connect() as connection:
        await connection.run_sync(do_run_migrations)


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
