---
description: テスト作成・修正時に参照するテスト戦略
globs:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/*.spec.ts"
  - "__tests__/**/*"
  - ".kiro/specs/**/design.md"
---

# taimei テスト戦略

## 基本方針

ロジックをテスト可能な層に寄せ、ユニットテストで検証する。コンポーネントの表示テストは書かない。

## テスト対象

| レイヤー | テスト | ツール | 備考 |
|---------|--------|--------|------|
| Effect-TS Service/Repository | ✅ | Vitest | Layer DI でモック不要 |
| カスタムフック | ✅ | Vitest | 純粋関数として抽出 |
| ユーティリティ (auth-guard等) | ✅ | Vitest | 外部依存のモックは許容 |
| Server/Client Component | ❌ | - | RSCとの相性問題、壊れやすい |
| E2E | 最小限 | Playwright | 認証フロー等の致命的パスのみ |

## 書かないテスト

- コンポーネントの表示・レンダリングテスト
- スナップショットテスト
- DOM構造の検証
- 網羅的なE2E（Railsのsystem spec的なもの）

## Effect-TS サービスのテスト

Layer DI を活用し、モックを最小化する。

```typescript
// テスト用 Layer を提供
const TestLayer = Layer.mergeAll(
  UserRepositoryTest,
  SomeServiceTest,
)

test('ユーザー作成', () =>
  Effect.gen(function* () {
    const service = yield* UserService
    const result = yield* service.create({ name: 'test' })
    expect(result.name).toBe('test')
  }).pipe(
    Effect.provide(TestLayer),
    Effect.runPromise,
  ))
```

## 薄いラッパー層のテスト

auth-guard のような薄いユーティリティは、外部依存のモックを許容する。
Effect-TS化による過度な抽象化は避ける。

```typescript
// 許容されるモック（外部依存）
vi.mock('next/navigation')
vi.mock('next/headers')
vi.mock('@/lib/auth')
```

## server-only モジュール

`server-only` を import するコードをテストする場合、vitest.config.ts でエイリアス設定済み。

```typescript
// vitest.config.ts
resolve: {
  alias: [
    { find: "server-only", replacement: "./__tests__/utils/server-only-mock.ts" },
  ],
}
```

## E2E テスト

書く場合は `e2e/tests/` に配置。以下のケースのみ:

- 認証フロー（ログイン、ログアウト、OAuth）
- 決済フロー
- その他「壊れたら致命的」なユーザージャーニー
