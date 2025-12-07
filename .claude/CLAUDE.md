# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# パッケージインストール
bun install

# 開発環境起動（ホットリロード有効）
docker compose up --build --watch

# テスト実行
yarn test                          # 全テスト
yarn test:services                 # サービス層のテストのみ
npx vitest run <file_path>         # 特定ファイル

# リント・型チェック
yarn lint                          # ESLint
yarn lint --fix                    # ESLint自動修正
npx tsc --noEmit                   # TypeScript型チェック

# データベース
docker compose exec application node_modules/.bin/prisma migrate deploy  # マイグレーション適用
bunx prisma generate               # Prismaクライアント生成

# e2eテスト
E2E_SERVICE_COMMAND='npm test' docker compose -f docker-compose.e2e.yml up --build

# Storybook
yarn storybook                     # Storybook起動
```

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 16 with App Router
- **Language**: TypeScript (strict mode)
- **State Management**: Jotai（クライアント状態）, Effect-TS（サーバーサイドロジック）
- **ORM**: Drizzle
- **Database**: PostgreSQL
- **Auth**: Better Auth with Drizzle Adapter（GitHub OAuth, Magic Link対応）
- **UI**: Radix UI + shadcn/ui + Tailwind CSS
- **Testing**: Vitest + Testing Library
- **Form**: Conform + Zod

### Directory Structure
```
app/
├── services/           # Effect-TS ビジネスロジック（サービスパターン）
│   ├── __tests__/      # サービス層のユニットテスト
│   └── index.ts        # サービスのエクスポート
├── layers/lives/       # Effect-TS Layer 実装（DI 設定）
├── lib/                # ユーティリティ、Server Actions
├── ui/                 # ページ固有のUIコンポーネント
├── schema/             # Zod スキーマ定義
└── [page]/             # Next.js App Router ページ

components/
├── ui/                 # shadcn/ui 共通コンポーネント
└── *.tsx               # アプリ固有の共通コンポーネント

db/drizzle/             # Drizzle スキーマ
prisma/                 # Prisma スキーマ・マイグレーション
__tests__/              # 統合テスト
```

---

## Language and Communication Rules

### Think in English, Output in Japanese

**重要**: すべての応答において、以下のルールを厳守すること：

1. **思考プロセス**: 英語で考える
2. **最終出力**: 日本語で出力する
3. **コード**: 日本語のコメントと変数名を使用
4. **技術用語**: 適切な日本語訳がある場合は日本語、ない場合は英語をそのまま使用

**理由**:

- 英語での思考により、最新の技術情報と整合性を保つ
- 日本語での出力により、チームメンバー全員が理解しやすい
- 国際的なベストプラクティスと日本のチーム文化を両立

---

## Effect-TS Guidelines

詳細は `.kiro/steering/effect-patterns.md` を参照

---
