# Effect-TS サービス リファクタリング計画

## 概要

- **目的**: Layer構築の最適化 + エラー定義の統一分離
- **PR数**: 2（各2コミット以内）
- **スキップ**: Tag2Service / DashboardService 標準化（現状維持が妥当）

---

## PR1: Layer最適化 + エラー分離（user系）

### 変更内容

#### 1. index.ts - Layer二重構築の解消

```typescript
// Before（問題）
AccountValidationService.Default.pipe(
  Layer.provide(UserService.Default.pipe(Layer.provide(PgDrizzleLive)))
)

// After（共有Layer）
const UserServiceLive = UserService.Default.pipe(Layer.provide(PgDrizzleLive));
export const Live = Layer.mergeAll(
  UserServiceLive,
  AccountValidationService.Default.pipe(Layer.provide(UserServiceLive)),
  // ...
);
```

#### 2. エラー分離（3ファイル新規作成）

| 新規ファイル | エラークラス |
|-------------|-------------|
| `user-errors.ts` | UserNotFound, UserServiceError |
| `user-profile-errors.ts` | UserProfileNotFound, UserProfileServiceError |
| `account-validation-errors.ts` | AccountAlreadyExists |

### 変更ファイル

- `app/services/index.ts` - Layer最適化 + re-export
- `app/services/user-errors.ts` - 新規
- `app/services/user-service.ts` - import変更
- `app/services/user-profile-errors.ts` - 新規
- `app/services/user-profile-service.ts` - import変更
- `app/services/account-validation-errors.ts` - 新規
- `app/services/account-validation-service.ts` - import変更

### コミット

1. Layer構築最適化（index.ts）
2. user/user-profile/account-validation エラー分離

---

## PR2: エラー分離（残り4サービス）

### 変更内容

| 新規ファイル | エラークラス |
|-------------|-------------|
| `invoice-errors.ts` | InvoiceNotFound, InvoiceServiceError |
| `customer-errors.ts` | CustomerServiceError |
| `dashboard-errors.ts` | DashboardServiceError |
| `tag2-errors.ts` | Tag2NotFound, Tag2ParseError, Tag2ServiceError |

### 変更ファイル

- `app/services/invoice-errors.ts` - 新規
- `app/services/invoice-service.ts` - import変更
- `app/services/customer-errors.ts` - 新規
- `app/services/customer-service.ts` - import変更
- `app/services/dashboard-errors.ts` - 新規
- `app/services/dashboard-service.ts` - import変更
- `app/services/tag2-errors.ts` - 新規
- `app/services/tag2-service.ts` - import変更
- `app/services/index.ts` - re-export追加

### コミット

1. invoice/customer エラー分離
2. dashboard/tag2 エラー分離 + index.ts更新

---

## スキップ理由

### Tag2Service（Schema.decode）
- `Schema.decode` は Effect-TS の正規パターン
- 他サービスとの差異はあるが、動作上問題なし

### DashboardService（内部関数）
- `fetchCardData` が内部関数を `Effect.all` で並列実行
- 内部関数は設計上必要

---

## 最終構造

```
app/services/
├── index.ts
├── id-generator-service.ts
├── auth-service.ts / auth-errors.ts      # 既存
├── user-service.ts / user-errors.ts      # PR1
├── user-profile-service.ts / user-profile-errors.ts  # PR1
├── account-validation-service.ts / account-validation-errors.ts  # PR1
├── invoice-service.ts / invoice-errors.ts  # PR2
├── customer-service.ts / customer-errors.ts  # PR2
├── dashboard-service.ts / dashboard-errors.ts  # PR2
└── tag2-service.ts / tag2-errors.ts      # PR2
```

---

## 検証方法

```bash
# 型チェック
bun tsc --noEmit

# 全テスト実行
bun run test:db

# ESLint
bun eslint app/services/
```

---

## 参照ファイル

- `app/services/index.ts` - Layer統合
- `app/services/auth-errors.ts` - エラー分離テンプレート
- `app/services/__tests__/db/effect-test-helpers.ts` - テスト用Layer
