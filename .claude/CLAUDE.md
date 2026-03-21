# CLAUDE.md

## Commands

```bash
bun install                        # パッケージインストール
docker compose up --build --watch  # 開発環境起動
bun run test:db                    # DB起動→全テスト→DB停止（推奨）
bun vitest run <file_path>         # 特定ファイルテスト（test_db起動済み前提）
bun eslint . --fix                 # ESLint自動修正
bun tsc --noEmit                   # 型チェック
bunx drizzle-kit generate          # マイグレーションSQL生成
bunx drizzle-kit migrate           # マイグレーション適用
E2E_SERVICE_COMMAND='npm test' docker compose -f docker-compose.e2e.yml up --build  # E2E
```

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
