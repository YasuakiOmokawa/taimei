# Project Structure

## Organization Philosophy

**App Router + サービスパターン**: Next.js App Router のディレクトリ規約に従いつつ、ビジネスロジックは Effect-TS サービスに分離。

## Directory Patterns

### App Router Pages
**Location**: `app/[route]/`
**Purpose**: ページコンポーネント、レイアウト
**Example**: `app/dashboard/page.tsx`, `app/login/page.tsx`

### Services (ビジネスロジック)
**Location**: `app/services/`
**Purpose**: Effect-TS サービス・リポジトリ
**Pattern**:
- `*-service.ts`: ビジネスロジック
- `*-repository.ts`: データアクセス
- `__tests__/`: ユニットテスト

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

### Conform Forms
**Location**: `app/use-conform/`
**Purpose**: Conform + Zod フォーム連携（Server Actions対応）

### Lib (ユーティリティ)
**Location**: `app/lib/`
**Purpose**: Server Actions、ユーティリティ関数

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
- ページ固有 → `app/[route]/` 配下
- 共有UI → `components/`
- ビジネスロジック → `app/services/`
- 設計書 → `docs_for_llm/` (PR時に削除)

---
_Document patterns, not file trees. New files following patterns shouldn't require updates_
