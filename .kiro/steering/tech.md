# Technology Stack

## Architecture

Next.js App Router ベースのフルスタックアプリケーション。Effect-TS によるサービスパターンでビジネスロジックを分離。

## Core Technologies

- **Language**: TypeScript 5.9+ (strict mode)
- **Framework**: Next.js 16 with App Router + Turbopack
- **Runtime**: Bun (パッケージ管理) / Node.js (実行環境)
- **Database**: PostgreSQL + Drizzle ORM

## Key Libraries

- **Effect-TS**: サービスパターン、エラーハンドリング、依存性注入
- **Better Auth**: 認証 (GitHub OAuth, Magic Link)
- **Jotai**: クライアント状態管理
- **Conform + Zod**: フォームバリデーション
- **Radix UI + shadcn/ui + Tailwind CSS**: UIコンポーネント

## Development Standards

### Type Safety
- TypeScript strict mode 必須
- Effect-TS の型推論を活用（公開APIには型注釈）
- `any` 禁止

### Code Quality
- ESLint (next lint) による静的解析
- Effect Language Service プラグイン有効

### Testing
- Vitest + Testing Library
- サービス層のユニットテスト: `yarn test:services`
- E2E: Playwright (docker-compose.e2e.yml)

### Error Handling
- **try-catch 禁止**: Either + TaggedError._tag で分岐
- すべてのデータアクセスは Effect-TS サービス経由

## Development Environment

### Required Tools
- Bun (パッケージ管理)
- Docker Compose (開発環境)
- Node.js 20+

### Common Commands
```bash
# Dev
docker compose up --build --watch

# Test
bun run test:db              # DB起動→全テスト→DB停止（推奨）
bun vitest run <file>        # 特定ファイル（test_db起動済み前提）

# Lint
bun eslint .                 # ESLint
bun tsc --noEmit             # 型チェック
```

## Key Technical Decisions

| 決定事項 | 選択 | 理由 |
|----------|------|------|
| ORM | Drizzle | 型安全性、Effect-TS統合 |
| 状態管理 | Jotai | React 19互換、シンプル |
| 認証 | Better Auth | Next.js App Router対応、柔軟性 |
| サーバーロジック | Effect-TS | テスタビリティ、エラー追跡 |
| フォーム | Conform + Zod | Server Actions対応、型安全 |

---
_Document standards and patterns, not every dependency_
