from __future__ import annotations

import logging

import uvicorn

from api import app
from settings import get_settings

settings = get_settings()

logging.getLogger("uvicorn.access").addFilter(
    lambda r: "GET /health" not in r.getMessage()
)


def main() -> None:
    uvicorn.run(app, host=settings.API_HOST, port=settings.API_PORT)


if __name__ == "__main__":
    main()
