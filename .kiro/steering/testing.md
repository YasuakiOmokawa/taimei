# Testing Standards

Effect-TS サービス層のテスト戦略とパターン。

## Philosophy

- **サービス層にロジックを寄せ、ユニットテストで検証**
- **Layer DI でモック不要**: 実 DB + トランザクションロールバック
- **コンポーネントの表示テストは書かない**

## Test Pyramid

```
     E2E (最小限)
    ────────────
   Integration (中)
  ──────────────────
 Service Unit (重点)
────────────────────────
```

## テスト対象

| レイヤー | テスト | 備考 |
|---------|--------|------|
| Effect-TS Service | ✅ | `dbEffect` で DB 統合テスト |
| カスタムフック | ✅ | 純粋関数として抽出 |
| ユーティリティ | ✅ | 外部依存のモックは許容 |
| Server/Client Component | ❌ | RSCとの相性問題 |
| E2E | 最小限 | 認証フロー等の致命的パスのみ |

## Service テストパターン

### dbEffect API
```typescript
import { dbEffect } from "./db/effect-test-helpers";

describe("InvoiceService", () => {
  dbEffect("正常系: 請求書を作成できる", ({ factory: f }) =>
    Effect.gen(function* () {
      // Arrange: Factory でテストデータ作成
      const customer = yield* Effect.promise(() => f.customer.create());

      // Act: Service 実行
      const service = yield* InvoiceService;
      const invoice = yield* service.create({
        customerId: customer.id,
        amount: 10000,
        status: "pending",
      });

      // Assert
      expect(invoice.customerId).toBe(customer.id);
    })
  );
});
```

### 特徴
- **withRollback**: テスト後に自動ロールバック（テスト間の分離）
- **factory**: トランザクション内でテストデータを作成
- **Effect.promise**: 非 Effect 関数を Effect に変換

## 純粋 Layer テスト

DB 不要のサービス（IdGenerator 等）は `@effect/vitest` を使用:
```typescript
import { it } from "@effect/vitest";

it.effect("UUID を生成する", () =>
  Effect.gen(function* () {
    const idGen = yield* IdGenerator;
    const id = yield* idGen.generate;
    expect(id).toMatch(/^[0-9a-f-]+$/);
  }).pipe(Effect.provide(IdGenerator.Live))
);
```

## テストファイル配置

```
app/services/
├── invoice-service.ts
└── __tests__/
    ├── invoice-service.test.ts
    ├── db/
    │   ├── effect-test-helpers.ts  # dbEffect API
    │   ├── test-db.ts              # withRollback
    │   └── global-setup.ts         # DB 接続
    └── factories/
        └── index.ts                # @praha/drizzle-factory
```

## コマンド

```bash
bun run test:db              # DB起動→全テスト→DB停止（推奨）
bun vitest run <file>        # 特定ファイル（test_db起動済み前提）
```

## 書かないテスト

- コンポーネントの表示・レンダリングテスト
- スナップショットテスト
- 網羅的なE2E

---
_Focus on patterns and decisions. Tool-specific config lives elsewhere._
