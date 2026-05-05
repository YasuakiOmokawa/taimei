# CLAUDE.md

## Commands

```bash
bun install                        # パッケージインストール
bun run test:db                    # DB起動→全テスト→DB停止（推奨）
bun vitest run <file_path>         # 特定ファイルテスト（test_db起動済み前提）
bun eslint . --fix                 # ESLint自動修正
bun tsc --noEmit                   # 型チェック
bunx drizzle-kit generate          # マイグレーションSQL生成
bunx drizzle-kit migrate           # マイグレーション適用
```

### Local Dev (sign 流統合)

```bash
docker compose up --build --watch  # taimei + taimei-auth + DB×2 + Redis を統合起動
```

ブラウザは `http://app.taimei-code.local:3001` でアクセス。Magic Link は test mode で console 出力されるため `docker logs taimei-auth-service-1 | grep "Magic Link"` で URL を取得して手動コピペ。

**前提**:
- 親ディレクトリに `taimei-auth` を clone (build context `../taimei-auth`)
- `/etc/hosts` に `127.0.0.1 app.taimei-code.local auth.taimei-code.local` を追加 (sudo 必要、 一度だけ)
- `.env` に `NPM_TOKEN=<read:packages 権限の GitHub PAT>` (GitHub Packages から `@taimei-code/auth-client` 取得用)
- port 3001 が空いていること (`docker stop freee-mcp-grafana-1` で解放できる)

### E2E (Playwright)

```bash
E2E_SERVICE_COMMAND='npm test' \
  docker compose -p taimei-e2e -f docker-compose.e2e.yml \
  up --build --abort-on-container-exit --exit-code-from e2e
```

`-p taimei-e2e` で dev compose と project / volume を分離。詳細は `e2e/README.md` 参照。

## Tech Stack

Next.js 16 (App Router) / TypeScript strict / Effect-TS / Drizzle + PostgreSQL / Better Auth / Radix + shadcn/ui + Tailwind / Vitest / Conform + Zod / Jotai

## Rules

プロジェクト規約は `.claude/rules/` を参照:

| ファイル | 内容 |
|---------|------|
| `effect-patterns.md` | Service・Layer・エラー設計・テストパターン |
| `testing-strategy.md` | テスト戦略・dbEffect・書かないテスト |
| `schema-library-usage.md` | ドメイン型 (Effect.Schema) / フォーム (Zod) |
| `external-library-integration.md` | 外部ライブラリ DIP パターン |
| `auth-design.md` | JIT プロビジョニング認証設計 |


## Language

Think in English, output in Japanese. コード内コメントも日本語。

## Framework Philosophy

新ライブラリ利用前に公式ドキュメントの設計思想を確認し、逸脱する場合は代替案を提案。

## Library Docs

- Better Auth: `https://www.better-auth.com/llms.txt`
- Next.js: `https://nextjs.org/docs/llms-full.txt`
- Effect-TS: `https://effect.website/llms-full.txt`
