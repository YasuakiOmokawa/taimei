#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

bun run build
WRANGLER_SEND_METRICS=false node node_modules/wrangler/bin/wrangler.js deploy testing/staging-worker.ts --dry-run --outdir staging-bundle
