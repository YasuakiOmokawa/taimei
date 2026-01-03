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
  make: Schema.decodeEither(XxxSchema),    // Either を返す（本番用）
  makeSync: Schema.decodeSync(XxxSchema),  // 例外を投げる（テスト用）
  unsafeFrom: (value: string): Xxx => ..., // DB取得値用（バリデーション済み前提）
} as const;
```

## ドメイン型の使用パターン

| ユースケース | API | 検証担当 |
|-------------|-----|---------|
| フォーム入力 | `make()` | Effect.Schema（Zodバリデーション後に変換） |
| テスト | `makeSync()` | Effect.Schema |
| DB取得値 | `unsafeFrom()` | なし（バリデーション済み前提） |

**注意**: Zod スキーマ内での `.transform()` + `unsafeFrom()` は、Next.js SSG + Bun 環境で互換性問題が発生するため使用しない。Server Action 内で `Email.make()` を使用すること。

## 使用例

```typescript
// フォーム入力 → Zod でバリデーション後、Server Action で Email.make() を使用
const loginSchema = z.object({
  email: z.email(),
});

// Server Action 内
const emailOrError = Email.make(submission.value.email);
if (Either.isLeft(emailOrError)) {
  return submission.reply({ fieldErrors: { email: ["..."] } });
}

// テスト → Effect.Schema で検証
const email = Email.makeSync("test@example.com");
userService.findByEmail(email);

// DB取得値 → unsafeFrom（バリデーション済み前提）
const email = Email.unsafeFrom(user.email);
```
