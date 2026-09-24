# CLAUDE.md

## Commands

```bash
bun install                        # パッケージインストール
bun run test:db                    # DB起動→全テスト→DB停止（推奨）
bun vitest run <file_path>         # 特定ファイルテスト（test_db起動済み前提）
bun eslint . --fix                 # ESLint自動修正
bun run typecheck                  # 型チェック (native TS7 = typescript7)
bunx drizzle-kit generate          # マイグレーションSQL生成
bunx drizzle-kit migrate           # マイグレーション適用
```

### Local Dev / E2E

開発環境起動・前提条件・Magic Link 取得・Mac ブラウザでのローカル動作確認・E2E 実行手順は `README.md` を参照。

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

## Pitfalls

### Git / GitHub
- **Stacked PR の上流マージで `--delete-branch` を付けない**: 下流 PR が auto-close され reopen 不可になる (理由: GitHub は base ブランチが merge されると下流を auto-retarget するが、delete されると orphan として close する)。下流をマージし終わってから手動でブランチ削除する。

### Lint / Formatter
- **`// eslint-disable-next-line` は formatter の改行で無効化される**: 行番号依存のため Biome 等が改行を入れると disable 対象がズレる。複数行に渡る式を suppress するときは disable コメントを実際の違反行の直上に置くか、ブロック形式 (`/* eslint-disable */ ... /* eslint-enable */`) を使う。
