# 外部ライブラリ統合パターン（Effect-TS Service + DIP）

## 概要

外部ライブラリ（認証、決済、メール送信等）を統合する際は、Effect-TS Service による依存関係逆転（DIP）パターンを適用する。

## 目的

1. ライブラリ変更時の影響を局所化（2-3ファイルに限定）
2. テスト容易性の確保（`new Service({...})` でモック作成）
3. 予測可能なコード配置（どこに何を書くか明確）

## パターン

### 依存関係逆転（DIP）

```
ビジネスロジック → Interface (Effect.Service) ← 実装 (Default Layer)
```

- ビジネスロジックは Interface（抽象）に依存
- 実装は Interface に依存（依存関係逆転）
- ライブラリ変更時は実装（effect 内部）のみ差し替え

### ディレクトリ構造

```
app/services/
├── <domain>-service.ts      # Effect.Service 定義（Default Layer 含む）
├── <domain>-errors.ts       # TaggedError 定義
└── index.ts                 # Layer 統合 + エクスポート

lib/<domain>/
├── messages/
│   └── <domain>-messages.ts # メッセージコード（UI 表示用）
└── <library>.ts             # ライブラリ設定
```

### コード例

```typescript
// Service 定義（app/services/<domain>-service.ts）
export class <Domain>Service extends Effect.Service<<Domain>Service>()(
  "services/<Domain>Service",
  {
    effect: Effect.gen(function* () {
      return {
        doSomething: (input: Input) =>
          Effect.tryPromise({
            try: async () => {
              // ライブラリ API 呼び出し
            },
            catch: (e) => new <Domain>Error({ cause: e }),
          }),
      } as const;
    }),
  }
) {}

// 使用側（ビジネスロジック）- Interface に依存
const result = await runService(() =>
  Effect.gen(function* () {
    const service = yield* <Domain>Service;
    yield* service.doSomething(input);
  })
);

// ライブラリ変更時は effect 内の実装を差し替えるだけ
```

### テストパターン

```typescript
// モック作成（new Service({...}) パターン）
const createMock<Domain>Service = (options: MockOptions = {}) =>
  new <Domain>Service({
    doSomething: (input) =>
      options.error
        ? Effect.fail(new <Domain>Error({ message: "mock error" }))
        : Effect.succeed({ result: "mock" }),
  });

// テスト実行
const runWithMock = <A, E>(
  effect: Effect.Effect<A, E, <Domain>Service>,
  mock: <Domain>Service
) =>
  effect.pipe(
    Effect.provideService(<Domain>Service, mock),
    Effect.either,
    Effect.runPromise
  );

// テストケース
it("正常系", async () => {
  const mock = createMock<Domain>Service();
  const result = await runWithMock(
    Effect.gen(function* () {
      const service = yield* <Domain>Service;
      return yield* service.doSomething({ input: "test" });
    }),
    mock
  );
  expect(Either.isRight(result)).toBe(true);
});
```

## 適用基準

### 適用する場合

- 外部 API/SDK を使用するライブラリ（認証、決済、メール送信等）
- 将来的に差し替えの可能性があるもの
- テストでモックが必要になりそうなもの

### 適用しない場合

- ユーティリティライブラリ（lodash, date-fns 等）
- UI ライブラリ（shadcn/ui 等）
- 薄いラッパーで十分なもの

## 参考実装

- `app/services/auth-service.ts`（認証）
- `app/services/auth-errors.ts`（認証エラー）
- `lib/auth/messages/auth-messages.ts`（認証メッセージ）
