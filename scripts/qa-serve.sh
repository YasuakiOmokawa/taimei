#!/usr/bin/env bash
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
TMP=${TMPDIR:-/tmp}
STATE=${TMP%/}/taimei-qa
PG=taimei-qa-pg
PG_URL=postgres://postgres:password@localhost:5446
APP_URL=http://localhost:3000
AUTH_ORIGIN=http://localhost:3110
SERVICE_KEY=qa-service-key
# 3100・5435 は手元の ssh のトンネルが使う
PORTS=(3000 3110 5446)

wait_for() {
  for _ in $(seq 1 120); do
    curl -s -o /dev/null "$1" && return 0
    sleep 1
  done
  echo "$1 に届かない ($STATE の log を見る)" >&2
  exit 1
}

auth_compose() {
  TAIMEI_AUTH_URL=$AUTH_ORIGIN TAIMEI_AUTH_HOSTNAME=taimei-auth-qa TAIMEI_AUTH_COOKIE_DOMAIN='' \
    TAIMEI_AUTH_CONSUMER_ORIGINS=$APP_URL TAIMEI_AUTH_SECRET=qa-secret-for-testing-harness-32chars \
    TAIMEI_AUTH_APP_NAME=taimei TAIMEI_AUTH_SERVICE_KEY=$SERVICE_KEY \
    docker compose -p taimei-qa -f "$ROOT/node_modules/@taimei-code/auth-client/testing/compose.yml" -f - "$@" <<'YAML'
services:
  taimei-auth:
    ports:
      - "127.0.0.1:3110:3100"
YAML
}

serve() {
  if [ ! -f "$ROOT/node_modules/@taimei-code/auth-client/testing/compose.yml" ]; then
    echo "taimei-auth の compose の断片が無い。root で bun install する (e2e/README.md の前提)" >&2
    exit 1
  fi
  for port in "${PORTS[@]}"; do
    if lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "port $port は使用中" >&2
      exit 1
    fi
  done
  mkdir -p "$STATE"

  docker run -d --name "$PG" -e POSTGRES_PASSWORD=password -p 5446:5432 postgres:16.8-alpine3.21 >/dev/null
  auth_compose up -d --wait >"$STATE/auth-compose.log" 2>&1 &
  local auth_pid=$!
  until docker exec "$PG" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
  docker exec "$PG" psql -qU postgres -c 'CREATE DATABASE taimei'
  DATABASE_URL=$PG_URL/taimei bunx drizzle-kit migrate >"$STATE/migrate.log" 2>&1
  docker exec -i "$PG" psql -qU postgres -d taimei -v ON_ERROR_STOP=1 <"$ROOT/db/local-app-role.sql"

  bun run build >"$STATE/app.log" 2>&1
  wait "$auth_pid" || { echo "auth が起動しない ($STATE/auth-compose.log を見る。ghcr.io に docker login していない時は e2e/README.md の前提)" >&2; exit 1; }
  PORT=3000 AUTH_URL=$AUTH_ORIGIN AUTH_SERVICE_URL=$AUTH_ORIGIN AUTH_SERVICE_KEY=$SERVICE_KEY DATABASE_URL=postgres://taimei_app:taimei_app@localhost:5446/taimei \
    nohup bun run start >>"$STATE/app.log" 2>&1 &
  wait_for "$APP_URL/"

  cat <<NEXT
ログイン: $APP_URL/dev-home を開き、開発用アカウントを押してから「アプリケーションに戻る」を押す (role は README.md の「開発環境」)
定期処理: bun run qa:cron
log: $STATE/app.log
止める: bun run qa:down (taimei と taimei-auth の DB も消す)
NEXT
}

cron() {
  curl -sf -o /dev/null "$APP_URL/cdn-cgi/handler/scheduled?cron=17+*+*+*+*" || {
    echo "$APP_URL の定期処理を起こせない (bun run qa:serve で起動してから流す。失敗の中身は $STATE/app.log)" >&2
    exit 1
  }
  grep purge-departed "$STATE/app.log" | tail -n 5 | grep . || echo "purge-departed の行がまだ無い ($STATE/app.log を見る)" >&2
}

down() {
  lsof -tiTCP:3000 -sTCP:LISTEN | xargs kill 2>/dev/null || true
  pkill -f "wrangler.js dev testing/worker.ts --ip 0.0.0.0 --port 3000" || true
  local out
  out=$(auth_compose down -v 2>&1) || { printf '%s\n' "$out" >&2; exit 1; }
  docker rm -f "$PG" >/dev/null 2>&1 || true
  rm -rf "$STATE"
}

case ${1:-} in
serve) serve ;;
cron) cron ;;
down) down ;;
*)
  echo "usage: $0 serve | cron | down" >&2
  exit 1
  ;;
esac
