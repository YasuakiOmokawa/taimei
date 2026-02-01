# 論理モデル設計書

## 概要

レビュー済み概念モデルから論理モデル（正規化済み、制約・インデックス設計）を作成する。

---

## 1. 正規化チェック

### 1.1 第一正規形（1NF）確認

| テーブル | 確認項目 | 結果 |
|---------|---------|------|
| products | 繰り返しグループなし、原子値のみ | ✅ OK |
| organization_products | 繰り返しグループなし、原子値のみ | ✅ OK |

### 1.2 第二正規形（2NF）確認

| テーブル | 主キー | 部分関数従属 | 結果 |
|---------|--------|-------------|------|
| products | id（単一主キー） | N/A | ✅ OK |
| organization_products | id（サロゲートキー） | N/A | ✅ OK |

**補足**: organization_products は複合ユニーク制約を持つが、主キーは単一サロゲートキー（id）のため、部分関数従属は発生しない。

### 1.3 第三正規形（3NF）確認

| テーブル | 推移的関数従属 | 結果 |
|---------|--------------|------|
| products | name, base_url → id のみ依存 | ✅ OK |
| organization_products | 全属性が id にのみ依存 | ✅ OK |

**結論**: 両テーブルとも第三正規形を満たしている。

---

## 2. 論理モデル（YAML形式）

```yaml
tables:
  # ================================================
  # Better Auth 管理テーブル（参照のみ、変更不可）
  # ================================================
  - name: user
    managed_by: better_auth
    description: Better Auth 標準ユーザーテーブル
    primary_key:
      columns: [id]
      type: text
    columns:
      - name: id
        type: text
        nullable: false
      - name: name
        type: text
        nullable: false
      - name: email
        type: text
        nullable: false
        unique: true
      - name: email_verified
        type: boolean
        nullable: false
        default: "false"
      - name: image
        type: text
        nullable: true
      - name: created_at
        type: timestamp
        nullable: false
        default: "now()"
      - name: updated_at
        type: timestamp
        nullable: false
        default: "now()"

  - name: organization
    managed_by: better_auth
    description: Better Auth 標準組織テーブル
    primary_key:
      columns: [id]
      type: text
    columns:
      - name: id
        type: text
        nullable: false
      - name: name
        type: text
        nullable: false
      - name: slug
        type: text
        nullable: false
        unique: true
      - name: logo
        type: text
        nullable: true
      - name: metadata
        type: text
        nullable: true
      - name: created_at
        type: timestamp
        nullable: false
        default: "now()"

  - name: member
    managed_by: better_auth
    description: Better Auth 標準メンバーシップテーブル
    primary_key:
      columns: [id]
      type: text
    columns:
      - name: id
        type: text
        nullable: false
      - name: user_id
        type: text
        nullable: false
      - name: organization_id
        type: text
        nullable: false
      - name: role
        type: text
        nullable: false
      - name: created_at
        type: timestamp
        nullable: false
        default: "now()"
    foreign_keys:
      - column: user_id
        references: user.id
        on_delete: cascade
      - column: organization_id
        references: organization.id
        on_delete: cascade
    unique_constraints:
      - columns: [user_id, organization_id]
        name: member_user_org_unique
    indexes:
      - columns: [user_id]
        name: member_user_id_idx
      - columns: [organization_id]
        name: member_organization_id_idx

  - name: session
    managed_by: better_auth
    description: Better Auth 標準セッションテーブル
    primary_key:
      columns: [id]
      type: text
    columns:
      - name: id
        type: text
        nullable: false
      - name: user_id
        type: text
        nullable: false
      - name: token
        type: text
        nullable: false
        unique: true
      - name: expires_at
        type: timestamp
        nullable: false
      - name: active_organization_id
        type: text
        nullable: true
    foreign_keys:
      - column: user_id
        references: user.id
        on_delete: cascade
      - column: active_organization_id
        references: organization.id
        on_delete: set_null
    indexes:
      - columns: [user_id]
        name: session_user_id_idx
      - columns: [active_organization_id]
        name: session_active_organization_id_idx

  - name: invitation
    managed_by: better_auth
    description: Better Auth 標準招待テーブル
    primary_key:
      columns: [id]
      type: text
    columns:
      - name: id
        type: text
        nullable: false
      - name: organization_id
        type: text
        nullable: false
      - name: email
        type: text
        nullable: false
      - name: role
        type: text
        nullable: false
      - name: status
        type: text
        nullable: false
      - name: expires_at
        type: timestamp
        nullable: false
      - name: inviter_id
        type: text
        nullable: false
    foreign_keys:
      - column: organization_id
        references: organization.id
        on_delete: cascade
      - column: inviter_id
        references: user.id
        on_delete: cascade
    indexes:
      - columns: [organization_id]
        name: invitation_organization_id_idx
      - columns: [inviter_id]
        name: invitation_inviter_id_idx

  # ================================================
  # アプリケーション管理テーブル（設計対象）
  # ================================================
  - name: products
    managed_by: application
    description: |
      プロダクトマスターデータ。
      マイグレーションでseed投入。
      自然キー（id）を使用し、アプリケーションコードで定数として参照。
    primary_key:
      columns: [id]
      type: text
      note: "自然キー（例: 'taimei', 'support'）"
    columns:
      - name: id
        type: text
        nullable: false
        comment: "プロダクト識別子（自然キー）。例: 'taimei', 'support'"
      - name: name
        type: text
        nullable: false
        comment: "プロダクト表示名"
      - name: base_url
        type: text
        nullable: false
        comment: "プロダクトのベースURL"
      - name: created_at
        type: timestamp
        nullable: false
        default: "now()"

  - name: organization_products
    managed_by: application
    description: |
      組織とプロダクトの多対多関係を管理する交差テーブル。
      組織が利用可能なプロダクトを記録。
    primary_key:
      columns: [id]
      type: text
      note: "UUIDv7 サロゲートキー"
    columns:
      - name: id
        type: text
        nullable: false
        generated: uuidv7
        comment: "サロゲートキー（UUIDv7）"
      - name: organization_id
        type: text
        nullable: false
        comment: "組織ID（organization.id への外部キー）"
      - name: product_id
        type: text
        nullable: false
        comment: "プロダクトID（products.id への外部キー）"
      - name: enabled_at
        type: timestamp
        nullable: false
        default: "now()"
        comment: "プロダクト有効化日時"
      - name: created_at
        type: timestamp
        nullable: false
        default: "now()"
    foreign_keys:
      - column: organization_id
        references: organization.id
        on_delete: cascade
        comment: "組織削除時に自動削除"
      - column: product_id
        references: products.id
        on_delete: restrict
        comment: "プロダクト削除を防止（使用中の場合）"
    unique_constraints:
      - columns: [organization_id, product_id]
        name: organization_products_org_product_unique
        comment: "同一組織に同一プロダクトは1つのみ"
    indexes:
      - columns: [organization_id]
        name: organization_products_organization_id_idx
        comment: "FK インデックス（PostgreSQL は自動作成しない）"
      - columns: [product_id]
        name: organization_products_product_id_idx
        comment: "FK インデックス + プロダクト別組織一覧クエリ用"

normalization:
  form: 3NF
  notes:
    - "products: 全属性が主キー（id）にのみ依存"
    - "organization_products: 全属性がサロゲートキー（id）にのみ依存"
    - "推移的関数従属なし"

design_decisions:
  - decision: "products.id に自然キー（text）を使用"
    reason: |
      - マスターデータであり、ID は不変
      - コード内で定数として参照しやすい（例: ProductId.TAIMEI）
      - 少数のレコードのため、パフォーマンスへの影響なし
    alternatives:
      - "UUIDv7: 却下。定数参照の利便性が失われる"
      - "bigint: 却下。同上"

  - decision: "organization_products.id にサロゲートキー（UUIDv7）を使用"
    reason: |
      - 交差テーブルの慣例に従う
      - フレームワーク（Drizzle/Better Auth）との互換性
      - 将来的な拡張（履歴管理等）に備える
    alternatives:
      - "複合主キー（organization_id, product_id）: 却下。Drizzle との相性を考慮"

  - decision: "organization_products → organization に CASCADE"
    reason: "組織削除時に関連付けも自動削除（所有関係）"

  - decision: "organization_products → products に RESTRICT"
    reason: "使用中のプロダクトを誤って削除することを防止"

  - decision: "products.id の値を TypeScript enum/const で定義"
    reason: |
      - 型安全性の確保
      - タイプミス防止
      - IDE 補完サポート
    implementation: |
      // app/domain/product-id.ts
      export const ProductId = {
        TAIMEI: "taimei",
        SUPPORT: "support",
      } as const;
      export type ProductId = (typeof ProductId)[keyof typeof ProductId];
```

---

## 3. PostgreSQL 型マッピング

| 論理型 | PostgreSQL 型 | Drizzle 定義 |
|--------|--------------|--------------|
| text | TEXT | `text()` |
| timestamp | TIMESTAMP WITHOUT TIME ZONE | `timestamp()` |
| boolean | BOOLEAN | `boolean()` |

**注意**: Better Auth 既存テーブルとの一貫性のため、`text()` を使用。

---

## 4. インデックス設計サマリー

### 4.1 必須インデックス（FK列）

| テーブル | 列 | インデックス名 | 理由 |
|---------|-----|---------------|------|
| organization_products | organization_id | organization_products_organization_id_idx | FK インデックス |
| organization_products | product_id | organization_products_product_id_idx | FK インデックス + プロダクト別検索 |

### 4.2 自動作成インデックス

| テーブル | 制約 | 自動作成 |
|---------|------|---------|
| products | PRIMARY KEY (id) | ✅ |
| organization_products | PRIMARY KEY (id) | ✅ |
| organization_products | UNIQUE (organization_id, product_id) | ✅ |

---

## 5. 制約一覧

### 5.1 products

| 制約タイプ | 定義 |
|-----------|------|
| PRIMARY KEY | id |
| NOT NULL | id, name, base_url, created_at |

### 5.2 organization_products

| 制約タイプ | 定義 |
|-----------|------|
| PRIMARY KEY | id |
| NOT NULL | id, organization_id, product_id, enabled_at, created_at |
| UNIQUE | (organization_id, product_id) |
| FOREIGN KEY | organization_id → organization.id ON DELETE CASCADE |
| FOREIGN KEY | product_id → products.id ON DELETE RESTRICT |

---

## 6. ER図（テキスト）

```
┌─────────────────┐       ┌──────────────────────────┐       ┌─────────────────┐
│   organization  │       │   organization_products  │       │    products     │
│ (Better Auth)   │       │     (Application)        │       │  (Application)  │
├─────────────────┤       ├──────────────────────────┤       ├─────────────────┤
│ PK id           │◄──┐   │ PK id (UUIDv7)           │   ┌──►│ PK id (自然キー)│
│    name         │   │   │ FK organization_id       │───┘   │    name         │
│    slug         │   └───│ FK product_id            │       │    base_url     │
│    ...          │       │    enabled_at            │       │    created_at   │
└─────────────────┘       │    created_at            │       └─────────────────┘
                          └──────────────────────────┘
                                    │
                          UNIQUE: (organization_id, product_id)
```

---

## 7. レビュー suggestions への対応

### 7.1 organization_products.product_id にインデックス追加

**対応済み**: `organization_products_product_id_idx` として追加

```yaml
indexes:
  - columns: [product_id]
    name: organization_products_product_id_idx
    comment: "FK インデックス + プロダクト別組織一覧クエリ用"
```

### 7.2 products.id の自然キー値を enum または定数として定義

**対応済み**: `design_decisions` に TypeScript 実装方針を記載

```typescript
// app/domain/product-id.ts
export const ProductId = {
  TAIMEI: "taimei",
  SUPPORT: "support",
} as const;
export type ProductId = (typeof ProductId)[keyof typeof ProductId];
```

---

## 8. 次のステップ

1. **物理設計者（Physical Designer）への引き継ぎ**
   - Drizzle スキーマ定義の作成
   - マイグレーション SQL 生成

2. **実装時の考慮事項**
   - products テーブルの seed データ作成
   - ProductId 定数の定義
   - organization_products Service の実装

---

## 承認確認

この論理モデル設計書のレビューをお願いします。問題がなければ、物理設計に進みます。
