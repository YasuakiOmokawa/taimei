# Project Structure

## Organization Philosophy

**App Router + サービスパターン**: Next.js App Router のディレクトリ規約に従いつつ、ビジネスロジックは Effect-TS サービスに分離。

## Directory Patterns

### App Router Pages
**Location**: `app/[route]/`
**Purpose**: ページコンポーネント、レイアウト
**Example**: `app/dashboard/page.tsx`, `app/auth/page.tsx`

### Services (ビジネスロジック)
**Location**: `app/services/`
**Purpose**: Effect-TS サービス（ビジネスロジック + DB アクセス）
**Pattern**:
- `*-service.ts`: ビジネスロジック（PgDrizzle を直接使用）
- `*-errors.ts`: TaggedError 定義
- `__tests__/`: ユニットテスト

> Repository 層は不要。Service が PgDrizzle を直接使用する。

### Domain (Brand 型)
**Location**: `app/domain/`
**Purpose**: Effect.Schema による Brand 型（Email 等）
**Pattern**:
- `Xxx.Schema`, `Xxx.make()`, `Xxx.fromTrusted()`
- Zod 検証後は `fromTrusted()` を使用

### Layers (DI設定)
**Location**: `app/layers/`
**Purpose**: Effect-TS Layer の実装
**Example**: `app/layers/lives/` にLive実装

### UI Components
**Location**: `app/ui/`
**Purpose**: ページ固有のUIコンポーネント

**Location**: `components/ui/`
**Purpose**: shadcn/ui 共通コンポーネント

**Location**: `components/*.tsx`
**Purpose**: アプリ固有の共通コンポーネント

### Schema
**Location**: `app/schema/`
**Purpose**: Zod スキーマ定義

### Server Actions
**Location**: `app/actions/`
**Purpose**: Server Actions（機能別ファイル）
**Example**: `app/actions/invoice.ts`, `app/actions/auth.ts`

### Data Fetching
**Location**: `app/data/`
**Purpose**: データ取得関数（機能別ファイル）
**Example**: `app/data/invoice.ts`, `app/data/customer.ts`

### Client Hooks
**Location**: `app/hooks/`
**Purpose**: クライアントフック（use-xxx.ts）
**Example**: `app/hooks/use-mobile.ts`, `app/hooks/use-current-user.ts`

### Atoms (Client State)
**Location**: `app/atoms/`
**Purpose**: Jotai atoms（クライアント状態）
**Example**: `app/atoms/form.ts`

### Auth
**Location**: `lib/auth/`
**Purpose**: Better Auth 設定（統合）
**Pattern**:
- `auth.ts`: サーバー設定
- `auth-client.ts`: クライアント設定
- `auth-guard.ts`: 認証ガード
- `hooks/`: 認証フック
- `messages/`: メッセージ定義

### Database
**Location**: `db/drizzle/`
**Purpose**: Drizzle スキーマ・クライアント

## Naming Conventions

- **Files**: kebab-case (`customer-service.ts`)
- **Components**: PascalCase (`LoginForm.tsx` → export `LoginForm`)
- **Services**: PascalCase (`CustomerService`)
- **Functions**: camelCase

## Import Organization

```typescript
// Effect-TS
import { Effect, Either, Context, Layer } from 'effect'
import { Data } from 'effect'

// External
import { someLib } from 'some-library'

// Internal (absolute)
import { CustomerService } from '@/app/services'
import { Button } from '@/components/ui/button'

// Relative (同一ディレクトリ)
import { helper } from './utils'
```

**Path Aliases**:
- `@/`: プロジェクトルート

## Code Organization Principles

### サービスパターン
- 外部依存はすべてサービス化（DB、API、randomUUIDなど）
- `Context.Tag` + `Layer` でDI設定
- Live/Test実装を分離

### エラー型
- `Data.TaggedError` でドメインエラーを定義
- `_tag` でパターンマッチ

### ファイル配置ルール

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
| ビジネスロジック | `app/services/` | `app/services/user-service.ts` |
| 共有UI | `components/` | `components/app-sidebar.tsx` |
| 設計書 | `docs_for_llm/` | PR時に削除 |

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
