# Domain Types Standards

Effect.Schema Brand型とData.caseによるドメイン型設計。

## Philosophy

- **単一値**: Effect.Schema Brand型（Email, UserId等）
- **複合オブジェクト**: Data.case（構造的等価性サポート）
- **フォーム入力**: Zod（Conform連携）

## ライブラリ使い分け

| 用途 | ライブラリ | 配置 |
|------|-----------|------|
| フォームバリデーション | Zod | `app/schema/` |
| 単一値Brand型 | Effect.Schema | `app/domain/` |
| 複合オブジェクト | Data.case | `app/domain/` |

## Brand型パターン

### API設計
```typescript
// app/domain/email.ts
import { Schema } from "effect";

const EmailSchema = Schema.String.pipe(
  Schema.filter((s) => ...),
  Schema.brand("Email")
);

export type Email = typeof EmailSchema.Type;

export const Email = {
  Schema: EmailSchema,
  make: Schema.decodeUnknownEither(EmailSchema),    // Either（未検証入力用）
  makeSync: Schema.decodeUnknownSync(EmailSchema),  // 例外（テスト用）
  fromTrusted: (value: string): Email => ...,       // 検証済み値用
} as const;
```

### 使用パターン

| ユースケース | API | 検証担当 |
|-------------|-----|---------|
| Zod検証後（Server Action） | `fromTrusted()` | Zod |
| テスト | `makeSync()` | Effect.Schema |
| DB取得値 | `fromTrusted()` | なし（検証済み前提） |
| 未検証の外部入力 | `make()` | Effect.Schema |

## Data.case パターン

複合オブジェクトには `Data.case` を使用（Data.Classはミュータブルになりうるため避ける）:

```typescript
import { Data } from "effect";
import type { Email } from "./email";

interface ShippingAddressFields {
  readonly email: Email;
  readonly postalCode: string;
  readonly city: string;
}

const ShippingAddress = Data.case<ShippingAddressFields>();
type ShippingAddress = Data.Data<ShippingAddressFields>;

export { ShippingAddress };
```

## 注意事項

- Zodスキーマ内での `.transform()` + `fromTrusted()` は Next.js SSG + Bun で互換性問題あり
- Server Action内でConform検証後に `fromTrusted()` を使用すること

---
_Focus on patterns and decisions. No exhaustive type listings._
