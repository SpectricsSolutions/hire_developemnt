.PHONY: link
link:
	chmod +x .githooks/pre-commit
	git config core.hooksPath .githooks

.PHONY: setup
setup: link
	cd api && uv sync
	cd app && pnpm install --frozen-lockfile

.PHONY: app-lint
app-lint:
	cd app && pnpm lint

.PHONY: api-lint
api-lint:
	cd api && uv run ruff check .

.PHONY: tf-lint
tf-lint:
	terraform fmt -check -recursive infra/
	terraform -chdir=infra/environments/staging init -backend=false -input=false
	terraform -chdir=infra/environments/staging validate
	terraform -chdir=infra/environments/production init -backend=false -input=false
	terraform -chdir=infra/environments/production validate

.PHONY: lint
lint:
	make -j2 app-lint api-lint tf-lint

.PHONY: app-build
app-build:
	cd app && pnpm build

.PHONY: build
build: app-build

.PHONY: api-dev
api-dev:
	cd api && set -a && . ../.env && set +a && uv run fastapi run --reload

.PHONY: app-dev
app-dev:
	cd app && pnpm dev

.PHONY: dev
dev:
	make -j2 app-dev api-dev

.PHONY: clients
clients:
	cd app && pnpm generate-client

.PHONY: docker-up
docker-up:
	@docker compose up -d --wait

.PHONY: docker-down
docker-down:
	@docker compose down

.PHONY: db-test-up
db-test-up:
	@docker compose up -d --wait db_test

.PHONY: api-test
api-test:
	cd api && env $$(cat ../.env.test | xargs) uv run pytest

.PHONY: api-test-watch
api-test-watch:
	cd api && env $$(cat ../.env.test | xargs) uv run ptw . --now -v

.PHONY: api-coverage
api-coverage: db-test-up
	cd api && env $$(cat ../.env.test | xargs) uv run pytest --cov --cov-report=term-missing

.PHONY: app-test
app-test:
	cd app && pnpm test

.PHONY: app-test-watch
app-test-watch:
	cd app && pnpm test:watch

.PHONY: app-coverage
app-coverage:
	cd app && pnpm test --coverage

.PHONY: test
test: db-test-up api-test app-test

.PHONY: coverage
coverage: db-test-up api-coverage app-coverage

.PHONY: test-watch
test-watch: db-test-up api-test-watch

.PHONY: api-fmt
api-fmt:
	cd api && uv run ruff check . --fix && uv run ruff format .

.PHONY: app-fmt
app-fmt:
	cd app && pnpm format

.PHONY: tf-fmt
tf-fmt:
	terraform fmt -recursive infra/

.PHONY: fmt
fmt: api-fmt app-fmt tf-fmt

.PHONY: clean
clean:
	rm -rf app/dist
	rm -rf app/.vite
	rm -rf app/coverage
	rm -rf api/htmlcov api/coverage.xml api/.coverage
	find api -type d \( -name __pycache__ -o -name .pytest_cache -o -name .ruff_cache \) -prune -exec rm -rf {} +
