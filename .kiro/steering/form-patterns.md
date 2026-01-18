# Form Patterns

Conform + Zod + Server Actions によるフォーム設計。

## Philosophy

- **Server Actions優先**: REST APIより Server Actions
- **Conform + Zod**: 型安全なフォームバリデーション
- **Effect-TS統合**: ビジネスロジックはService経由

## ディレクトリ構成

```
app/
├── schema/                    # Zodスキーマ定義
│   ├── login.ts
│   └── invoice.ts
└── use-conform/               # Conformフォーム連携
    ├── schema.ts              # フォーム固有スキーマ
    └── action.ts              # Server Action
```

## Server Action パターン

### 基本構造
```typescript
"use server";

import { parseWithZod } from "@conform-to/zod/v4";
import { schema } from "./schema";
import { runService } from "@/app/services";
import { Effect, Either } from "effect";

export async function createData(_prevState: unknown, formData: FormData) {
  // 1. Conform でバリデーション
  const submission = parseWithZod(formData, { schema });
  if (submission.status !== "success") {
    return submission.reply();
  }

  // 2. Effect-TS Service 実行
  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* SomeService;
      return yield* service.execute(submission.value);
    })
  );

  // 3. Either + TaggedError._tag でエラー分岐
  if (Either.isLeft(result)) {
    switch (result.left._tag) {
      case "SomeNotFound":
        return submission.reply({ formErrors: ["見つかりません"] });
      default:
        return submission.reply({ formErrors: ["システムエラー"] });
    }
  }

  // 4. 成功時
  await setFlash({ type: "success", message: "成功しました" });
  redirect("/thanks");
}
```

## Zod スキーマ

### 配置
- **再利用可能**: `app/schema/{domain}.ts`
- **フォーム固有**: `app/use-conform/schema.ts`

### パターン
```typescript
// app/schema/login.ts
import { z } from "zod";

export const emailLinkLoginSchema = z.object({
  email: z.email("有効なメールアドレスを入力してください"),
});
```

## ドメイン型との連携

```typescript
// Zod検証後、fromTrusted()でBrand型に変換
import { Email } from "@/app/domain/email";

const result = await runService(() =>
  Effect.gen(function* () {
    const service = yield* SomeService;
    return yield* service.execute({
      email: Email.fromTrusted(submission.value.email),
    });
  })
);
```

## エラーレスポンス

### フィールドエラー
```typescript
submission.reply({
  fieldErrors: { email: ["無効なメールアドレス"] },
});
```

### フォーム全体エラー
```typescript
submission.reply({
  formErrors: ["データの作成に失敗しました"],
});
```

### 複合エラー
```typescript
submission.reply({
  fieldErrors: { email: [result.left.message] },
  formErrors: ["データの作成に失敗しました"],
});
```

## シグネチャパターン

| 用途 | シグネチャ |
|------|-----------|
| 標準フォーム | `(prevState: unknown, formData: FormData)` |
| ID指定操作 | `(id: string, prevState: unknown, formData: FormData)` |

## 禁止事項

- Zodスキーマ内での `.transform()` + `fromTrusted()` は避ける（Next.js SSG + Bun互換性問題）
- try-catch禁止（Either + TaggedError._tagを使用）

---
_Focus on integration patterns. No component implementation details._
