# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# パッケージインストール
bun install

# 開発環境起動（ホットリロード有効）
docker compose up --build --watch

# テスト実行
bun vitest                         # 全テスト
bun vitest run app/services        # サービス層のテストのみ
bun vitest run <file_path>         # 特定ファイル

# リント・型チェック
bun eslint .                       # ESLint
bun eslint . --fix                 # ESLint自動修正
bun tsc --noEmit                   # TypeScript型チェック

# データベース
bunx drizzle-kit migrate           # マイグレーション適用
bunx drizzle-kit generate          # スキーマからマイグレーションSQL生成

# e2eテスト
E2E_SERVICE_COMMAND='npm test' docker compose -f docker-compose.e2e.yml up --build

# Storybook
bun storybook                      # Storybook起動
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
├── api/                # Next.js API Routes（Better Auth等）
├── services/           # Effect-TS ビジネスロジック
│   ├── __tests__/      # サービス層のユニットテスト
│   ├── *-service.ts    # サービス（ビジネスロジック + データアクセス）
│   ├── *-errors.ts     # TaggedError 定義
│   └── index.ts        # サービスのエクスポート
├── layers/lives/       # Effect-TS Layer 実装（DI 設定）
├── lib/                # アプリ固有ユーティリティ
│   ├── actions.ts      # Server Actions
│   ├── data.ts         # データ取得関数
│   ├── atoms/          # Jotai atoms（クライアント状態）
│   ├── hooks/          # カスタムフック
│   └── schema/         # Zodスキーマ（フォーム用）
├── use-conform/        # Conform フォーム連携（Server Actions対応）
├── ui/                 # ページ固有のUIコンポーネント
├── schema/             # Zod スキーマ定義（共通）
└── [page]/             # Next.js App Router ページ
    └── (dashboard, login, setting, signup, steps, thanks)

lib/                    # グローバルユーティリティ
├── auth.ts             # Better Auth サーバー設定
├── auth-client.ts      # Better Auth クライアント設定
└── utils.ts            # 共通ユーティリティ（cn等）

components/
├── ui/                 # shadcn/ui 共通コンポーネント
└── *.tsx               # アプリ固有の共通コンポーネント

db/drizzle/             # Drizzle スキーマ定義
drizzle/                # Drizzle マイグレーションSQL
__tests__/              # 統合テスト
e2e/                    # E2Eテスト（Playwright）
├── tests/              # テストファイル
└── playwright.config.ts
hooks/                  # グローバルカスタムフック
middlewares/            # Next.js ミドルウェア
stories/                # Storybook ストーリー
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

## Library Documentation

### Better Auth
調査時は `https://www.better-auth.com/llms.txt` を参照すること。

---
