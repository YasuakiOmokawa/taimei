# マルチプロダクト組織モデル設計（改訂版 v2）

## 概要

マルチプロダクト戦略に向けた組織モデルの追加。ユーザーが複数組織に所属し、組織が複数プロダクトを利用できる構造を実現。

## 設計方針（確定）

### 分散型設計

```
┌─────────────────────────────────────────────────────────────┐
│                   中央（taimei-core）                        │
├─────────────────────────────────────────────────────────────┤
│  知っていること:                                             │
│  - どの組織がどのプロダクトを使っているか（有効化状態）       │
│  - プロダクトの登録情報（ID、名前、URL）                     │
│                                                             │
│  知らないこと:                                               │
│  - 各プロダクトのプラン詳細（課金システムが管理）            │
│  - 各プロダクトのロール詳細（各プロダクトが管理）            │
└─────────────────────────────────────────────────────────────┘
```

### 確定要件

| 項目 | 決定事項 |
|------|---------|
| 初期プロダクト | `invoicing`（請求書管理）、`health`（健康管理） |
| カラム命名規約 | **camelCase**（Better Auth と統一） |
| ID生成方式 | **UUIDv7**（時系列ソート可能） |
| プラン管理 | スコープ外（課金システム導入時に追加） |
| ロール管理 | 組織レベルのみ（Better Auth標準） |
| アクセス制御 | 組織メンバー = 全プロダクトアクセス可 |
| プロダクト無効化 | **スコープ外**（将来検討） |

### 削除するもの（YAGNI）

- `plan` カラム
- `organization_product_members` テーブル
- `app/config/products.ts`
- `PRODUCT_PLANS`, `PRODUCT_ROLES` 定義

---

## スキーマ設計（DBML分析反映）

### ER図

```
┌─────────────────┐       ┌──────────────────────────┐       ┌─────────────────┐
│   organization  │       │   organizationProducts   │       │    products     │
│ (Better Auth)   │       │     (Application)        │       │  (Application)  │
├─────────────────┤       ├──────────────────────────┤       ├─────────────────┤
│ PK id           │◄──┐   │ PK id (UUIDv7)           │   ┌──►│ PK id (自然キー)│
│    name         │   │   │ FK organizationId        │───┘   │    name         │
│    slug         │   └───│ FK productId             │       │    baseUrl      │
│    ...          │       │    enabledAt             │       │    createdAt    │
└─────────────────┘       │    createdAt             │       └─────────────────┘
                          └──────────────────────────┘
                                    │
                          UNIQUE: (organizationId, productId)
                          INDEX: organizationId, productId
```

### products テーブル（マスターデータ）

```typescript
// db/drizzle/schema.ts
export const products = pgTable("products", {
  id: text("id").primaryKey(),           // 自然キー: "invoicing", "health"
  name: text("name").notNull(),          // 表示名
  baseUrl: text("baseUrl").notNull(),    // プロダクトURL
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

**Note**: マスターデータはマイグレーションで INSERT。削除禁止（RESTRICT）。

### organizationProducts テーブル（交差テーブル）

```typescript
export const organizationProducts = pgTable(
  "organizationProducts",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()), // UUIDv7推奨
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    productId: text("productId")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    enabledAt: timestamp("enabledAt").defaultNow().notNull(),  // ビジネス日時
    createdAt: timestamp("createdAt").defaultNow().notNull(),  // 監査用
  },
  (table) => [
    uniqueIndex("organizationProducts_orgProduct_unique")
      .on(table.organizationId, table.productId),
    index("organizationProducts_organizationId_idx")
      .on(table.organizationId),  // FK インデックス（必須）
    index("organizationProducts_productId_idx")
      .on(table.productId),       // FK インデックス + 検索用
  ],
);
```

### 初期データ（マイグレーション内）

```sql
INSERT INTO products (id, name, "baseUrl", "createdAt") VALUES
  ('invoicing', '請求書管理', 'https://invoicing.taimei.com', NOW()),
  ('health', '健康管理', 'https://health.taimei.com', NOW());
```

### ProductId 型定義

```typescript
// app/domain/product-id.ts
import { Schema } from "effect";

const ProductIdValues = {
  INVOICING: "invoicing",
  HEALTH: "health",
} as const;

const ProductIdSchema = Schema.String.pipe(
  Schema.filter((s): s is ProductIdType =>
    Object.values(ProductIdValues).includes(s as ProductIdType)
  ),
  Schema.brand("ProductId")
);

type ProductIdType = (typeof ProductIdValues)[keyof typeof ProductIdValues];
export type ProductId = typeof ProductIdSchema.Type;

export const ProductId = {
  ...ProductIdValues,
  Schema: ProductIdSchema,
  make: Schema.decodeUnknownEither(ProductIdSchema),
  fromTrusted: (value: string): ProductId => value as ProductId,
} as const;
```

---

## 外部キー設計

| 参照元 | 参照先 | ON DELETE | 理由 |
|--------|--------|-----------|------|
| organizationProducts.organizationId | organization.id | **CASCADE** | 組織削除時に自動削除 |
| organizationProducts.productId | products.id | **RESTRICT** | マスター保護（使用中は削除禁止） |

---

## 実装計画（3PR）

### PR1: スキーマ定義 + Better Auth Organization プラグイン

**変更ファイル:**
- `db/drizzle/schema.ts` - products, organizationProducts テーブル追加
- `drizzle/` - マイグレーションSQL（初期データ含む）
- `lib/auth.ts` - organization プラグイン追加
- `lib/auth-client.ts` - organizationClient プラグイン追加
- `app/domain/product-id.ts` - ProductId Brand型定義

**検証:**
- `bunx drizzle-kit generate` → マイグレーションSQL生成
- `bunx drizzle-kit migrate` → マイグレーション適用
- `bun tsc --noEmit` → 型チェック
- DB確認: products テーブルに初期データ2件

---

### PR2: 個人組織自動作成 Hook + OrganizationProductService

**変更ファイル:**
- `lib/auth/hooks/personal-org-hook.ts` - 新規
- `lib/auth.ts` - Hook統合
- `app/services/organization-product-service.ts` - 新規
- `app/services/organization-product-errors.ts` - 新規
- `app/services/index.ts` - Layer統合
- `app/services/__tests__/organization-product-service.test.ts` - 新規

**OrganizationProductService API:**
```typescript
{
  enableProduct: (input: { organizationId: string; productId: ProductId }) => Effect<...>,
  hasAccess: (organizationId: string, productId: ProductId) => Effect<boolean, ...>,
  listByOrganization: (organizationId: string) => Effect<OrganizationProduct[], ...>,
}
```

**検証:**
- `bun run test:db` で Service テスト
- 手動: OAuth登録 → 個人組織作成 → サインアップ元プロダクト有効化確認

---

### PR3: Server Actions + UI

**変更ファイル:**
- `app/lib/actions.ts` - enableProductAction 追加
- `app/lib/data.ts` - getOrganizationProducts 追加
- `app/(pages)/setting/products/page.tsx` - 新規
- `app/ui/settings/product-settings.tsx` - 新規

**検証:**
- 開発環境でプロダクト有効化操作を確認
- 表示出し分けが正しく動作することを確認

---

## 主要フロー

### 新規登録フロー

```
User → プロダクトサイト → MagicLink認証
                              ↓
                        Better Auth
                              ↓
                        user作成
                              ↓
                      個人組織作成（Hook）
                              ↓
              organizationProducts INSERT（サインアップ元プロダクト）
```

### 表示出し分けフロー

```
User → プロダクトアクセス
              ↓
    organizationProducts チェック
              ↓
    有効 → ダッシュボード表示
    無効 → セットアップ画面表示
```

---

## M&A拡張性

```
M&A時の追加手順:
1. products テーブルに新プロダクト INSERT
2. app/domain/product-id.ts に新ID追加
3. 買収プロダクトの認証を Better Auth に置き換え
4. 買収プロダクトに organizationProducts チェック追加

本体コード変更: 最小限（ProductId定義のみ）
```

---

## 未解決の質問

なし（全て確定済み）
