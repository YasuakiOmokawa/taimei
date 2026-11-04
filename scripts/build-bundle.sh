#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

stage="${1:?usage: $0 <stage>}"
entry=$(bun infra/stage-outputs.ts "$stage" | sed -n 's/^entry=//p')

bun run build
rm -rf bundle
WRANGLER_SEND_METRICS=false node node_modules/wrangler/bin/wrangler.js deploy "$entry" --dry-run --outdir bundle
