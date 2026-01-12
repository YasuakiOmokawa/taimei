# API Standards

Server Actions パターンと Effect-TS によるデータ操作の規約。

## Philosophy

- **Server Actions 優先**: REST API より Server Actions を優先
- **Effect-TS 経由**: すべてのデータ操作は Effect-TS サービス経由
- **Conform 連携**: フォームバリデーションは Conform + Zod

## Server Actions パターン

### 基本構造
```typescript
"use server";

export async function createInvoice(_prevState: unknown, formData: FormData) {
  // 1. Conform でフォームバリデーション
  const submission = parseWithZod(formData, { schema: invoiceSchema });
  if (submission.status !== "success") {
    return submission.reply();
  }

  // 2. Effect-TS サービス実行
  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* InvoiceService;
      return yield* service.create(submission.value);
    })
  );

  // 3. Either + TaggedError._tag でエラー分岐
  if (Either.isLeft(result)) {
    switch (result.left._tag) {
      case "InvoiceNotFound":
        return submission.reply({ formErrors: ["請求書が見つかりません"] });
      default:
        return submission.reply({ formErrors: [`エラー: ${result.left._tag}`] });
    }
  }

  // 4. 成功時の処理
  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}
```

### シグネチャパターン
| 用途 | シグネチャ |
|------|-----------|
| フォーム送信 | `(prevState: unknown, formData: FormData)` |
| ID指定操作 | `(id: string, prevState: unknown, formData: FormData)` |
| 追加引数あり | `(arg: T, prevState: unknown, formData: FormData)` |

## REST API (例外ケース)

Better Auth ハンドラーなど外部ライブラリ連携のみ:
```
app/api/auth/[...all]/route.ts  → Better Auth
```

## エラーレスポンス

### フォームエラー
```typescript
submission.reply({
  fieldErrors: { email: ["無効なメールアドレス"] },
  formErrors: ["データの作成に失敗しました"],
});
```

### Flash メッセージ
```typescript
await setFlash({ type: "success", message: "Invoice deleted." });
await setFlash({ type: "error", message: "Invoice not found." });
```

## Data Fetching

### Server Components から直接呼び出し
```typescript
// app/lib/data.ts
export async function fetchInvoiceById(id: string) {
  return await runService(() =>
    Effect.gen(function* () {
      const service = yield* InvoiceService;
      return yield* service.findById(id);
    })
  );
}
```

## 禁止事項

- **try-catch 禁止**: Either + TaggedError._tag で分岐
- **直接 DB アクセス禁止**: Effect-TS サービス経由
- **REST API 乱立禁止**: Server Actions を優先

---
_Focus on patterns and decisions, not endpoint catalogs._
