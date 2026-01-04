# ドメイン型の設計

## ライブラリの使い分け

| 用途 | ライブラリ | 配置場所 |
|------|-----------|---------|
| フォーム入力（Conform連携） | Zod | `app/lib/schema/`, `app/schema/` |
| 単一値ドメイン型（Brand型） | Effect.Schema | `app/domain/` |
| 複合オブジェクト | Data.case | `app/domain/` |

## 理由

- **Zod**: Conform と統合済み、フォームバリデーション向け
- **Effect.Schema**: Effect-TS エコシステム内で統一、Brand 型との相性◎

## ドメイン型の API パターン

```typescript
// app/domain/xxx.ts
import { Schema } from "effect";

const XxxSchema = Schema.String.pipe(
  Schema.filter(...),
  Schema.brand("Xxx")
);

export type Xxx = typeof XxxSchema.Type;

export const Xxx = {
  Schema: XxxSchema,
  make: Schema.decodeUnknownEither(XxxSchema),    // Either を返す（未検証の外部入力用）
  makeSync: Schema.decodeUnknownSync(XxxSchema),  // 例外を投げる（テスト用）
  fromTrusted: (value: string): Xxx => ..., // 検証済み値用（Zod検証後、DB取得値）
} as const;
```

## ドメイン型の使用パターン

| ユースケース | API | 検証担当 |
|-------------|-----|---------|
| Zod 検証後（Server Action） | `fromTrusted()` | Zod（Effect.Schema での再検証不要） |
| テスト | `makeSync()` | Effect.Schema |
| DB取得値 | `fromTrusted()` | なし（バリデーション済み前提） |
| 未検証の値 | `make()` | Effect.Schema |

**注意**: Zod スキーマ内での `.transform()` + `fromTrusted()` は、Next.js SSG + Bun 環境で互換性問題が発生するため使用しない。Server Action 内で Conform 検証後に `fromTrusted()` を使用すること。

## 使用例

```typescript
// Server Action 内 → Zod 検証後は fromTrusted を使用
const loginSchema = z.object({
  email: z.email(),
});

// Conform で検証後
if (submission.status !== "success") {
  return submission.reply();
}
const email = Email.fromTrusted(submission.value.email);

// テスト → Effect.Schema で検証
const email = Email.makeSync("test@example.com");
userService.findByEmail(email);

// DB取得値 → fromTrusted（バリデーション済み前提）
const email = Email.fromTrusted(user.email);
```

## 複合オブジェクト（Data.case）

複数のフィールドを持つ値オブジェクトには `Data.case` を使用する。

### なぜ Data.case か

- **Data.Class はメソッドを持てるが、ミュータブルな実装が可能になる危険性がある**
- Data.case はデータのみを持ち、振る舞いは別関数として分離（関数型スタイル）
- 構造的等価性（`Equal.equals`）をサポート

### 実装パターン

```typescript
// app/domain/shipping-address.ts
import { Data } from "effect";
import type { Email } from "./email";

interface ShippingAddressFields {
  readonly email: Email;
  readonly postalCode: string;
  readonly city: string;
  readonly street: string;
}

const ShippingAddress = Data.case<ShippingAddressFields>();
type ShippingAddress = Data.Data<ShippingAddressFields>;

export { ShippingAddress, type ShippingAddressFields };
```

### 使用例

```typescript
import { Equal } from "effect";
import { ShippingAddress } from "@/app/domain/shipping-address";
import { Email } from "@/app/domain/email";

// 生成
const address = ShippingAddress({
  email: Email.fromTrusted("test@example.com"),
  postalCode: "123-4567",
  city: "東京都",
  street: "渋谷区1-2-3",
});

// 更新（常に新しいオブジェクトを返す）
const updated = ShippingAddress({ ...address, city: "大阪府" });

// 構造的等価性
const same = ShippingAddress({
  email: Email.fromTrusted("test@example.com"),
  postalCode: "123-4567",
  city: "東京都",
  street: "渋谷区1-2-3",
});
Equal.equals(address, same); // true
```

### Brand 型との組み合わせ

複合オブジェクト内のフィールドには Brand 型を使用し、型安全性を確保する:

```typescript
interface OrderFields {
  readonly id: OrderId;           // Brand 型
  readonly customerEmail: Email;  // Brand 型
  readonly amount: Money;         // Brand 型
  readonly shippingAddress: ShippingAddress; // 複合オブジェクト
}

const Order = Data.case<OrderFields>();
```
