# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# パッケージインストール
bun install

# 開発環境起動（ホットリロード有効）
docker compose up --build --watch

# テスト実行（test_db が必要）
bun run test:db                    # DB起動→全テスト→DB停止（推奨）
bun vitest run <file_path>         # 特定ファイル（test_db起動済み前提）

# リント・型チェック
bun eslint .                       # ESLint
bun eslint . --fix                 # ESLint自動修正
bun tsc --noEmit                   # TypeScript型チェック

# データベース（本番用。テストはglobalSetupで自動実行）
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
├── actions/            # Server Actions（機能別ファイル）
├── data/               # データ取得関数（機能別ファイル）
├── schema/             # Zod スキーマ（フォーム用、機能別ファイル）
├── hooks/              # クライアントフック（use-xxx.ts）
├── atoms/              # Jotai atoms（クライアント状態）
├── domain/             # ドメイン型（Effect.Schema Brand型）
├── services/           # Effect-TS ビジネスロジック
│   ├── __tests__/      # サービス層のテスト
│   │   ├── db/         # DB テスト基盤（withRollback, runServiceWithTx）
│   │   └── factories/  # テストデータファクトリ（@praha/drizzle-factory）
│   ├── *-service.ts    # サービス（ビジネスロジック + DB アクセス）
│   ├── *-errors.ts     # TaggedError 定義
│   └── index.ts        # サービスのエクスポート + Layer 統合
├── layers/lives/       # Effect-TS Layer 実装（DI 設定）
├── ui/                 # ページ固有のUIコンポーネント
└── [page]/             # Next.js App Router ページ（page.tsx, layout.tsxのみ）
    └── (auth, dashboard, setting, steps, thanks)

lib/                    # グローバルユーティリティ
├── auth/               # Better Auth 設定（統合）
│   ├── auth.ts         # サーバー設定
│   ├── auth-client.ts  # クライアント設定
│   ├── auth-guard.ts   # 認証ガード
│   ├── hooks/          # 認証フック
│   └── messages/       # メッセージ定義
├── email/              # メール送信
├── flash-toaster/      # Flash通知
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
middlewares/            # Next.js ミドルウェア
stories/                # Storybook ストーリー
```

### 配置ルール

| カテゴリ | 配置場所 | 例 |
|---------|---------|-----|
| Server Actions | `app/actions/` | `app/actions/invoice.ts` |
| Zodスキーマ | `app/schema/` | `app/schema/invoice.ts` |
| Effect.Schema Brand型 | `app/domain/` | `app/domain/email.ts` |
| データ取得関数 | `app/data/` | `app/data/invoice.ts` |
| クライアントフック | `app/hooks/` | `app/hooks/use-avatar.ts` |
| Jotai Atoms | `app/atoms/` | `app/atoms/form.ts` |
| ページ固有UI | `app/ui/[feature]/` | `app/ui/invoices/table.tsx` |
| 認証設定 | `lib/auth/` | `lib/auth/auth.ts` |

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

## フレームワークの設計思想を尊重する

新しいフレームワークやライブラリを使う実装を行う前に:

1. **公式ドキュメントで設計思想を調査する**
2. **ユーザーの指示が設計思想に沿っているか確認する**
3. **沿っていない場合は、設計思想に沿った代替案を提案する**

---

## Library Documentation

### Better Auth
調査時は `https://www.better-auth.com/llms.txt` を参照すること。

### Next.js
調査時は `https://nextjs.org/docs/llms-full.txt` を参照すること。

### Effect-TS
調査時は `https://effect.website/llms-full.txt` を参照すること。

---
