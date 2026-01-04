# スキーマライブラリの使い分け

## ルール

| 用途 | ライブラリ | 配置場所 |
|------|-----------|---------|
| フォーム入力（Conform連携） | Zod | `app/lib/schema/`, `app/schema/` |
| ドメイン型（Brand型） | Effect.Schema | `app/domain/` |

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
