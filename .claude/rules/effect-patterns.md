# Effect 規約 (v4)

汎用の Effect API は `node_modules/effect/AGENTS.md` に従う。ここには本リポ固有の規約だけを書く。

## Service

- DB、外部 API/SDK (認証、メール等)、`next/headers`、グローバル (`crypto.randomUUID` 等) は Service 越しに触る。Service は `Db` (drizzle) を直接使い、Repository 層は作らない。
- 形は `app/services/customer-service.ts` に揃える:

```typescript
export class XxxService extends Context.Service<XxxService>()(
  "services/XxxService",
  { make: Effect.gen(function* () { const db = yield* Db; return { ... } as const; }) },
) {
  static readonly layer = Layer.effect(this, this.make);
}
```

- 依存の結線は `app/services/index.ts` の `Live` だけで行う。テスト用の差し替えは `layerTest` という static に置く (例: `AuthClient.layerTest`)。
- 事業所データを読む Service は method 内で `CompanyContext` を `yield*` し、`Live` には入れない。理由は `docs/adr/0002-company-data-scoping.md`。

## エラー

- `<domain>-errors.ts` に `Data.TaggedError` で定義する。
- 失敗は `return yield* new XxxError(...)` で返す。Promise は `Effect.tryPromise({ try, catch: (e) => new XxxError(...) })` で包む。

## Server Action / Server Component

`runService` (事業所スコープは `runScopedService`) で実行し、返る `Result` を `_tag` で分岐する。try-catch は書かない。

```typescript
const result = await runScopedService(() =>
  Effect.gen(function* () {
    const service = yield* InvoiceService;
    return yield* service.create(input);
  }),
);
if (Result.isFailure(result)) {
  switch (result.failure._tag) {
    case "CustomerNotInScope":
      return submission.reply({ fieldErrors: { customerId: ["指定した顧客が見つかりません"] } });
    default:
      return submission.reply({ formErrors: ["請求書の作成に失敗しました"] });
  }
}
```
