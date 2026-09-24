# taimei

コード内コメントは日本語で書く。

## Effect

Effect のコードを書く前に `node_modules/effect/AGENTS.md` を最後まで読み、書く API に関わるリンク先を辿る (v4 の API は学習データの v3 と違う)。そこに無い API は `node_modules/effect/src` を検索する。

## Gotcha

- 型チェックは `bun run typecheck`。bare の `tsc` は TypeScript 6.0 を指す。
- `bun vitest run <file>` の前に `docker compose up -d test_db --wait` が要る。全件は `bun run test:db`。
- `// eslint-disable-next-line` は Biome の改行で対象行がずれる。複数行の式はブロック形式で囲む。
- Stacked PR の上流は `--delete-branch` なしでマージする。付けると下流 PR が auto-close され reopen できない。ブランチは下流のマージ後に消す。
