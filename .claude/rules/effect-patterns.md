# Effect-TS Code Design Guidelines

## Effect-TS Best Practices

### データアクセスとエラーハンドリングの原則

1. **全データアクセスを Effect-TS サービス経由に統一**
2. **Service が PgDrizzle を直接使用**（Repository 層は不要）
3. **エラーハンドリングは `Either` + `TaggedError._tag` で分岐**
4. **try-catch 禁止**

```typescript
// ✅ 推奨: Server Action でのエラーハンドリング
export async function updateUser(id: string, formData: FormData) {
  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* UserProfileService;
      return yield* service.upsert(id, formData.get("bio") as string);
    })
  );

  // Either + TaggedError._tag で分岐
  if (Either.isLeft(result)) {
    switch (result.left._tag) {
      case "UserProfileNotFound":
        return { error: "プロフィールが見つかりません" };
      case "UserProfileServiceError":
        return { error: "データベースエラーが発生しました" };
      default:
        return { error: "予期しないエラーが発生しました" };
    }
  }

  return { data: result.right };
}

// ❌ 禁止: try-catch によるエラーハンドリング
export async function updateUser(id: string, formData: FormData) {
  try {
    const result = await someOperation();
    return { data: result };
  } catch (e) {
    return { error: "エラーが発生しました" };
  }
}
```

### Conform との統合

Server Action で Conform のフォームバリデーションと Effect-TS のエラーハンドリングを組み合わせる：

```typescript
// app/lib/use-conform/action.ts
export async function createData(_prevState: unknown, formData: FormData) {
  // 1. Conform でフォームバリデーション
  const submission = parseWithZod(formData, { schema });

  if (submission.status !== "success") {
    return submission.reply();
  }

  // 2. Effect-TS サービス実行
  const result = await runService(() =>
    ConformAccountRegistrationService.execute(submission.value)
  );

  // 3. Either + TaggedError._tag でエラー分岐
  if (Either.isLeft(result)) {
    switch (result.left._tag) {
      case "AccountAlreadyExists":
        return submission.reply({
          fieldErrors: { email: [result.left.message] },
          formErrors: ["データの作成に失敗しました"],
        });
      default:
        return submission.reply({
          formErrors: ["システムエラーが発生しました"],
        });
    }
  }

  // 4. 成功時の処理
  await setFlash({ type: "success", message: "データの作成に成功しました。" });
  redirect("/thanks");
}
```

**ポイント**:
- `submission.reply()` でフォームにエラーを返却
- `fieldErrors` で特定フィールドにエラー表示
- `formErrors` でフォーム全体にエラー表示

### Yieldable Errors

**推奨**: `yield* new TaggedError()` を直接使用

```typescript
// ✅ 推奨
class MyError extends Data.TaggedError("MyError")<{ message: string }> {}

Effect.gen(function* () {
  if (condition) {
    return yield* new MyError({ message: "Error occurred" });
  }
});

// ❌ 非推奨（冗長）
Effect.gen(function* () {
  if (condition) {
    return yield* Effect.fail(new MyError({ message: "Error occurred" }));
  }
});
```

**理由**: 公式ドキュメントで推奨されており、より簡潔

### Service Pattern

**原則**: 外部依存はすべてサービス化し、Service が PgDrizzle を直接使用する

**サービス化すべき依存**:

- データベース接続（PgDrizzle）
- 外部 API 呼び出し
- ファイルシステムアクセス
- **グローバル変数（crypto.randomUUID など）**

**理由**:

- テスタビリティの向上（モック不要）
- 依存関係の明示化
- 実装の差し替えが容易
- Repository 層は冗長なため不要

```typescript
// ✅ 推奨: Service が PgDrizzle を直接使用
import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { Data, Effect } from "effect";
import { users } from "@/db/drizzle/schema";
import { eq } from "drizzle-orm";

export class UserServiceError extends Data.TaggedError("UserServiceError")<{
  message: string;
}> {}

export class UserService extends Effect.Service<UserService>()(
  "services/UserService",
  {
    effect: Effect.gen(function* () {
      const pgdrizzle = yield* PgDrizzle.PgDrizzle;

      return {
        findByEmail: (email: string) =>
          Effect.tryPromise({
            try: () =>
              pgdrizzle
                .select()
                .from(users)
                .where(eq(users.email, email))
                .then((res) => res.at(0)),
            catch: (e) =>
              new UserServiceError({ message: `findByEmail failed: ${e}` }),
          }),
      } as const;
    }),
  }
) {}
```

### Effect.Tag vs Effect.Service の使い分け

**Effect.Service を使用する場合（推奨）**:

- 標準的なサービス実装
- `.Default` Layer のみで十分なケース
- 外部ライブラリ統合（認証、決済等）

```typescript
// Effect.Service パターン（推奨）
export class AuthService extends Effect.Service<AuthService>()(
  "services/AuthService",
  {
    effect: Effect.gen(function* () {
      return { /* implementation */ } as const;
    }),
  }
) {}

// 使用時
AuthService.Default  // 自動生成された Layer
```

**Effect.Tag を使用する場合**:

- 複数の Layer バリアント（Test, Custom 等）が必要
- テスト用に複数の実装パターンを提供したい場合

```typescript
// Effect.Tag パターン（複数 Layer が必要な場合）
export class IdGenerator extends Effect.Tag("services/IdGenerator")<
  IdGenerator,
  IdGeneratorService
>() {
  static Live = Layer.succeed(this, { generate: () => crypto.randomUUID() });
  static Test = Layer.succeed(this, { generate: () => "fixed-uuid" });
  static TestSequence = Layer.sync(this, () => { /* sequential */ });
  static Custom = (gen: () => string) => Layer.succeed(this, { generate: gen });
}
```

**参考**: `IdGenerator`（Live, Test, TestSequence, Custom の4バリアント）

### カスタム Layer パターン

Effect.Service で依存関係を差し替えたい場合、`.Default` をベースに `Layer.provide` で提供:

```typescript
export class ConformAccountRegistrationService extends Effect.Service<ConformAccountRegistrationService>()(
  "services/ConformAccountRegistrationService",
  {
    effect: Effect.gen(function* () {
      const idGen = yield* IdGenerator;
      return { /* implementation using idGen */ } as const;
    }),
  }
) {
  // カスタム実装を提供
  static Test = Layer.provide(this.Default, IdGenerator.Test);
  static TestSequence = Layer.provide(this.Default, IdGenerator.TestSequence);
}
```

**参考**: `ConformAccountRegistrationService`

### Type Annotations

**原則**: 公開 API には型注釈を付ける、内部関数は型推論に任せる

```typescript
// ✅ 公開API: 型を明示
export type Account = {
  readonly id: string;
  readonly name: string;
};

export const execute = (
  input: CreateAccountInput
): Effect.Effect<Account, AccountAlreadyExists> => { ... }

// ✅ 内部関数: 型推論に任せる
const validateAccount = (email: string) =>
  Effect.gen(function* () { ... });
```

**理由**: Effect 公式ドキュメントでは型推論に頼る例が多数

### Service テストパターン

**原則**: `withRollback` + `runServiceWithTx` で実 DB を使用したトランザクション分離テスト

```typescript
import { describe, it, expect } from "vitest";
import { Effect, Either } from "effect";
import { UserService } from "../user-service";
import {
  withRollback,
  useFactoryReset,
  getFactory,
  runServiceWithTx,
} from "./db/test-helpers";

describe("UserService", () => {
  useFactoryReset();

  it("ユーザーを取得できる", async () => {
    await withRollback(async (tx) => {
      // Factory でテストデータ作成
      const f = getFactory(tx);
      const user = await f.user.create({ email: "test@example.com" });

      // Service 実行
      const result = await runServiceWithTx(
        tx,
        Effect.gen(function* () {
          const service = yield* UserService;
          return yield* service.findByEmail("test@example.com");
        })
      );

      // Either で結果検証
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right?.id).toBe(user.id);
      }
    });
  });
});
```

**ポイント**:
- `withRollback`: テスト後に自動ロールバック（テスト間の分離）
- `runServiceWithTx`: トランザクション内で Service Layer を構築
- `getFactory`: トランザクション内でテストデータを作成
- `useFactoryReset`: Factory のシーケンスをテストごとにリセット

### Effect.void vs 暗黙的な undefined

**原則**: 暗黙的な `undefined` で問題なし

```typescript
// ✅ これで十分
const validateAccount = (email: string) =>
  Effect.gen(function* () {
    if (condition) {
      return yield* new MyError({ ... });
    }
    // 暗黙的な undefined
  });

// ❌ 不要（公式ドキュメントでも必須とされていない）
const validateAccount = (email: string) =>
  Effect.gen(function* () {
    if (condition) {
      return yield* new MyError({ ... });
    }
    return yield* Effect.void; // 冗長
  });
```

**例外**: 条件分岐で明示的に「何もしない」を示したい場合のみ `Effect.void` を使用
