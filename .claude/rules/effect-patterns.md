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
// app/use-conform/action.ts
export async function createData(_prevState: unknown, formData: FormData) {
  // 1. Conform でフォームバリデーション
  const submission = parseWithZod(formData, { schema });

  if (submission.status !== "success") {
    return submission.reply();
  }

  // 2. Effect-TS サービス実行
  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* AccountValidationService;
      return yield* service.validate({
        email: Email.fromTrusted(submission.value.email),
        name: submission.value.name,
      });
    })
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

### サービスファイル命名規約

**ファイル名**: kebab-case + `-service.ts` サフィックス

| ファイル種別 | 命名パターン | 例 |
|-------------|-------------|-----|
| サービス本体 | `{domain}-service.ts` | `auth-service.ts`, `user-profile-service.ts` |
| エラー定義 | `{domain}-errors.ts` | `auth-errors.ts` |
| Layer統合 | `index.ts` | - |

**クラス名**: PascalCase（ファイル名から変換）

```
auth-service.ts → AuthService
user-profile-service.ts → UserProfileService
```

**理由**:
- Next.js / Node.js エコシステムはkebab-caseが主流
- シェル操作・検索との相性が良い（`rg auth-service`）
- Effect-TS公式は規約を強制していない

### エラー定義の分離パターン

**原則**: エラークラスは `*-errors.ts` に分離し、サービスファイルには置かない

```
app/services/
├── user-service.ts      # サービス実装のみ
├── user-errors.ts       # TaggedError 定義
└── index.ts             # re-export（サービス + エラー）
```

**理由**:
- サービスファイルの責務を単一化
- エラー型の再利用性向上
- `auth-errors.ts` パターンとの統一

**index.ts での re-export**:
```typescript
export { UserService } from "./user-service";
export { UserNotFound, UserServiceError } from "./user-errors";
```

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
import { Effect } from "effect";
import { users } from "@/db/drizzle/schema";
import { eq } from "drizzle-orm";
import { UserServiceError } from "./user-errors";

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

### Layer 共有変数パターン

依存サービスの Layer 二重構築を防ぐため、共有変数化する:

```typescript
// ❌ 二重構築（UserService.Default が2回評価される）
AccountValidationService.Default.pipe(
  Layer.provide(UserService.Default.pipe(Layer.provide(PgDrizzleLive)))
)

// ✅ 共有変数化
const UserServiceLive = UserService.Default.pipe(Layer.provide(PgDrizzleLive));

export const Live = Layer.mergeAll(
  UserServiceLive,
  AccountValidationService.Default.pipe(Layer.provide(UserServiceLive)),
);
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
export class ExampleService extends Effect.Service<ExampleService>()(
  "services/ExampleService",
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

`dbEffect`（`app/services/__tests__/db/effect-test-helpers.ts`）を使う。詳細は `testing-strategy.md` を参照。

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
