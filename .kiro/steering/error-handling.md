# Error Handling Standards

Effect-TS TaggedError と Either パターンによるエラーハンドリング。

## Philosophy

- **try-catch 禁止**: Either + TaggedError._tag で分岐
- **型安全なエラー**: Data.TaggedError でドメインエラーを定義
- **明示的なエラーフロー**: Effect が返す Either で成功/失敗を区別

## Error Classification

### TaggedError 定義
```typescript
// app/services/invoice-service.ts
export class InvoiceNotFound extends Data.TaggedError("InvoiceNotFound")<{
  message: string;
}> {}

export class InvoiceServiceError extends Data.TaggedError("InvoiceServiceError")<{
  message: string;
}> {}
```

### 命名規約
| パターン | 用途 |
|----------|------|
| `XxxNotFound` | リソースが見つからない |
| `XxxServiceError` | サービス層の一般エラー |
| `XxxAlreadyExists` | 重複エラー |

## Error Propagation

### Service 層
```typescript
export class InvoiceService extends Effect.Service<InvoiceService>()(
  "services/InvoiceService",
  {
    effect: Effect.gen(function* () {
      const pgdrizzle = yield* PgDrizzle.PgDrizzle;

      return {
        findById: (id: string) =>
          Effect.tryPromise({
            try: () => pgdrizzle.select()...,
            catch: (e) => new InvoiceServiceError({ message: `${e}` }),
          }).pipe(
            Effect.flatMap((result) =>
              result
                ? Effect.succeed(result)
                : Effect.fail(new InvoiceNotFound({ message: id }))
            )
          ),
      };
    }),
  }
) {}
```

### Server Actions 層
```typescript
if (Either.isLeft(result)) {
  switch (result.left._tag) {
    case "InvoiceNotFound":
      return submission.reply({ formErrors: ["請求書が見つかりません"] });
    case "InvoiceServiceError":
      return submission.reply({ formErrors: ["システムエラー"] });
    default:
      return submission.reply({ formErrors: ["予期しないエラー"] });
  }
}
```

## Error Response

### Conform フォームエラー
```typescript
submission.reply({
  fieldErrors: { email: ["無効なメールアドレス"] },
  formErrors: ["データの作成に失敗しました"],
});
```

### Flash メッセージ
```typescript
await setFlash({ type: "error", message: "Invoice not found." });
```

### メッセージコード管理
```typescript
// lib/auth/messages/auth-messages.ts
export const AuthErrorCode = {
  SIGNOUT_FAILED: "SIGNOUT_FAILED",
  MAGIC_LINK_FAILED: "MAGIC_LINK_FAILED",
} as const;

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  SIGNOUT_FAILED: "ログアウトに失敗しました",
  MAGIC_LINK_FAILED: "マジックリンクの送信に失敗しました",
};
```

## Yieldable Errors

```typescript
// ✅ 推奨: 直接 yield*
Effect.gen(function* () {
  if (condition) {
    return yield* new MyError({ message: "Error" });
  }
});

// ❌ 非推奨（冗長）
Effect.gen(function* () {
  if (condition) {
    return yield* Effect.fail(new MyError({ message: "Error" }));
  }
});
```

## 禁止事項

- **try-catch**: Either + TaggedError._tag を使用
- **stringly-typed errors**: TaggedError で型安全に
- **エラー握りつぶし**: 必ずログまたはユーザー通知

---
_Focus on patterns and decisions. No implementation details or exhaustive lists._
