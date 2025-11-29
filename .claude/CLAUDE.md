# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

```bash
# パッケージインストール
bun install

# 開発環境起動（ホットリロード有効）
docker compose up --build --watch

# テスト実行
yarn test                          # 全テスト
yarn test:services                 # サービス層のテストのみ
npx vitest run <file_path>         # 特定ファイル

# リント・型チェック
yarn lint                          # ESLint
yarn lint --fix                    # ESLint自動修正
npx tsc --noEmit                   # TypeScript型チェック

# データベース
docker compose exec application node_modules/.bin/prisma migrate deploy  # マイグレーション適用
bunx prisma generate               # Prismaクライアント生成

# e2eテスト
E2E_SERVICE_COMMAND='npm test' docker compose -f docker-compose.e2e.yml up --build

# Storybook
yarn storybook                     # Storybook起動
```

## Architecture Overview

### Tech Stack
- **Framework**: Next.js 16 (beta) with App Router
- **Language**: TypeScript (strict mode)
- **State Management**: Jotai（クライアント状態）, Effect-TS（サーバーサイドロジック）
- **ORM**: Prisma + Drizzle（両方併用）
- **Database**: PostgreSQL
- **Auth**: NextAuth.js v5 (beta) with Prisma Adapter
- **UI**: Radix UI + shadcn/ui + Tailwind CSS
- **Testing**: Vitest + Testing Library
- **Form**: Conform + Zod

### Directory Structure
```
app/
├── services/           # Effect-TS ビジネスロジック（サービスパターン）
│   ├── __tests__/      # サービス層のユニットテスト
│   └── index.ts        # サービスのエクスポート
├── layers/lives/       # Effect-TS Layer 実装（DI 設定）
├── lib/                # ユーティリティ、Server Actions
├── ui/                 # ページ固有のUIコンポーネント
├── schema/             # Zod スキーマ定義
└── [page]/             # Next.js App Router ページ

components/
├── ui/                 # shadcn/ui 共通コンポーネント
└── *.tsx               # アプリ固有の共通コンポーネント

db/drizzle/             # Drizzle スキーマ
prisma/                 # Prisma スキーマ・マイグレーション
__tests__/              # 統合テスト
```

### Service Pattern (Effect-TS)

サービスは `Context.Tag` で定義し、Live/Test/TestSequence Layer を提供：

```typescript
export class MyService extends Context.Tag("services/MyService")<
  MyService,
  MyServiceInterface
>() {
  static Live = Layer.succeed(this, liveImplementation);
  static Test = Layer.succeed(this, testImplementation);
  static TestSequence = Layer.sync(this, () => { /* ... */ });
}
```

テスト時は `runWithLayer` ヘルパーを使用（`app/services/__tests__/test-helpers.ts`）

---

## Language and Communication Rules

### Think in English, Output in Japanese

**重要**: すべての応答において、以下のルールを厳守すること：

1. **思考プロセス**: 英語で考える
2. **最終出力**: 日本語で出力する
3. **コード**: 日本語のコメントと変数名を使用
4. **技術用語**: 適切な日本語訳がある場合は日本語、ない場合は英語をそのまま使用

**理由**:

- 英語での思考により、最新の技術情報と整合性を保つ
- 日本語での出力により、チームメンバー全員が理解しやすい
- 国際的なベストプラクティスと日本のチーム文化を両立

---

## Effect-TS Code Design Guidelines

### Information Search Strategy

Effect-TS に関する情報を調査する際は、以下の戦略に従うこと：

#### 1. 公式ドキュメントへの直接アクセス（推奨）

**使用ツール**: `WebFetch`

**手順**:

1. `.llm/effect.txt`（インデックスファイル）から関連ページを特定
2. WebFetch で公式ドキュメントから直接情報を取得
3. 必要に応じて複数ページを並列で取得

**例**:

```typescript
WebFetch(
  "https://effect.website/docs/error-management/yieldable-errors/",
  "yield* new TaggedError()の使い方を抽出"
);
```

**メリット**:

- 最新の情報を取得できる
- 詳細な説明とコード例が含まれる
- ファイルサイズの制限を回避

#### 2. 型定義ファイルの直接参照

**使用ツール**: `Read`, `Grep`

**対象ファイル**:

```
node_modules/effect/dist/dts/*.d.ts
```

**用途**:

- API の正確な型シグネチャを確認
- 利用可能なメソッド一覧を取得
- 公式ドキュメントに記載がない詳細を確認

**例**:

```typescript
Read("node_modules/effect/dist/dts/Random.d.ts");
```

#### 3. WebSearch による補足情報の取得

**使用ツール**: `WebSearch`

**用途**:

- 公式ドキュメントにない実装例を探す
- コミュニティのベストプラクティスを調査
- 特定の問題の解決策を検索

**例**:

```typescript
WebSearch("Effect-TS service pattern testability");
```

### Effect Documentation Index

`.llm/effect.txt` は**インデックスファイル**として使用する：

**✅ 有効な使い方**:

- 関連するドキュメントページを特定
- カテゴリから適切なページを見つける
- ドキュメント構造を把握

**❌ 非効率な使い方**:

- 詳細情報を直接取得しようとする（ファイルサイズ制限により不可能）
- すべての情報をこのファイルに含めようとする

### Recommended Search Flow

```
1. 課題の特定
   ↓
2. .llm/effect.txt で関連ページを検索
   ↓
3a. WebFetch で公式ドキュメント取得（詳細な説明が必要な場合）
   ↓
3b. Read で型定義確認（APIシグネチャが必要な場合）
   ↓
3c. WebSearch で補足情報検索（コミュニティ情報が必要な場合）
   ↓
4. 複数の情報源を統合して結論を出す
```

---

## Effect-TS Best Practices

### データアクセスとエラーハンドリングの原則

1. **全データアクセスを Effect-TS サービス経由に統一**
2. **エラーハンドリングは `Either` + `TaggedError._tag` で分岐**
3. **try-catch 禁止**

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
      case "UserProfileRepositoryError":
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

**原則**: 外部依存はすべてサービス化する

**サービス化すべき依存**:

- データベース接続
- 外部 API 呼び出し
- ファイルシステムアクセス
- **グローバル変数（crypto.randomUUID など）**

**理由**:

- テスタビリティの向上（モック不要）
- 依存関係の明示化
- 実装の差し替えが容易

**実装パターン**:

```typescript
export class MyService extends Context.Tag("MyService")<
  MyService,
  MyServiceInterface
>() {
  static Live = Layer.succeed(this, liveImplementation);
  static Test = Layer.succeed(this, testImplementation);
  static Custom = (impl: MyServiceInterface) => Layer.succeed(this, impl);
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

---
