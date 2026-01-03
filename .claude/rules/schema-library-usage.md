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
| フォーム入力 | Zod `.transform()` + `unsafeFrom()` | Zod |
| テスト | `makeSync()` | Effect.Schema |
| DB取得値 | `unsafeFrom()` | なし（バリデーション済み前提） |

## 使用例

```typescript
// フォーム入力 → Zod + transform でドメイン型に変換
// Zod がバリデーション済みなので unsafeFrom で変換
const loginSchema = z.object({
  email: z.email().transform((s) => Email.unsafeFrom(s)),
});

// テスト → Effect.Schema で検証
const email = Email.makeSync("test@example.com");
userService.findByEmail(email);

// DB取得値 → unsafeFrom（バリデーション済み前提）
const email = Email.unsafeFrom(user.email);
```
