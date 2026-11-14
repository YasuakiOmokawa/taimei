#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${NPM_TOKEN:-}" ] && ! grep -qsE '^NPM_TOKEN=.+' .env; then
  echo "NPM_TOKEN が無い。read:packages を持つ GitHub の token を環境変数か root の .env で渡す (例: NPM_TOKEN=\$(/opt/homebrew/bin/gh auth token) bun run e2e。e2e/README.md の前提)" >&2
  exit 1
fi

main_tree=$(git worktree list --porcelain | sed -n '1s/^worktree //p')
if ! ls certs/*.pem >/dev/null 2>&1 && ls "$main_tree"/certs/*.pem >/dev/null 2>&1; then
  mkdir -p certs
  cp "$main_tree"/certs/*.pem certs/
fi

compose() {
  docker compose -p taimei-e2e -f docker-compose.e2e.yml "$@"
}

compose down --volumes
E2E_SERVICE_COMMAND=${*:-npm test} compose up --build --abort-on-container-exit --exit-code-from e2e
