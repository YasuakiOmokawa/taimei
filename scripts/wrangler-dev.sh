#!/usr/bin/env bash
# --env-file を渡すと wrangler は .env と .dev.vars を読まない
set -euo pipefail
cd "$(dirname "$0")/.."

env_file=".wrangler/dev.env"
mkdir -p .wrangler
# AUTH_SERVICE_KEY などの秘密が入るので本人だけが読める
rm -f "$env_file"
(umask 077 && : >"$env_file")
# single quote で囲まないと dotenv-expand が `$` を展開し、` #` 以降を落とす
while IFS='=' read -r k v; do printf "%s='%s'\n" "$k" "$v" >>"$env_file"; done < <(env | grep -E '^(APP_|AUTH_)[A-Z0-9_]*=' || true)

export CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE="${DATABASE_URL:-postgres://postgres:password@127.0.0.1:5433/postgres}"
export WRANGLER_SEND_METRICS=false
port="${PORT:-3001}"

exec node node_modules/wrangler/bin/wrangler.js dev testing/worker.ts "$@" --ip 0.0.0.0 --port "$port" --local-upstream "${LOCAL_UPSTREAM:-localhost:$port}" --env-file "$env_file"
