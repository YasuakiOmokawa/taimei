/**
 * Effect-TS テストヘルパー
 *
 * ## 使い分け
 *
 * | テスト種別 | 使用 API | 用途 |
 * |-----------|----------|------|
 * | DB 統合テスト | `dbEffect` | Service + DB アクセスのテスト |
 * | 純粋 Layer テスト | `it.effect` (@effect/vitest) | DB 不要のテスト（IdGenerator 等） |
 *
 * ## DB 統合テスト（dbEffect）
 * ```typescript
 * import { dbEffect } from "./db/effect-test-helpers";
 *
 * dbEffect("テスト名", ({ factory: f }) =>
 *   Effect.gen(function* () {
 *     const user = yield* Effect.promise(() => f.user.create());
 *     const service = yield* UserService;
 *     // ...
 *   })
 * );
 * ```
 *
 * ## 純粋 Layer テスト（it.effect）
 * ```typescript
 * import { it } from "@effect/vitest";
 *
 * it.effect("テスト名", () =>
 *   Effect.gen(function* () {
 *     const service = yield* IdGenerator;
 *     // ...
 *   }).pipe(Effect.provide(IdGenerator.Live))
 * );
 * ```
 */

import { it as vitestIt } from "@effect/vitest";
import { Effect, Layer } from "effect";
import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import type { PgRemoteDatabase } from "drizzle-orm/pg-proxy";
import { withRollback, type TestDb } from "./test-db";
import { factory } from "../factories";
import { UserService } from "../../user-service";
import { UserProfileService } from "../../user-profile-service";
import { CustomerService } from "../../customer-service";
import { InvoiceService } from "../../invoice-service";
import { DashboardService } from "../../dashboard-service";
import { IdGenerator } from "../../id-generator-service";

export type TestFactory = ReturnType<typeof factory>;

export interface DbTestContext {
  tx: TestDb;
  factory: TestFactory;
}

type ServiceLayer =
  | UserService
  | UserProfileService
  | CustomerService
  | InvoiceService
  | DashboardService;

const createTestServiceLayer = (tx: TestDb) => {
  const TestPgDrizzleLayer = Layer.succeed(
    PgDrizzle.PgDrizzle,
    tx as unknown as PgRemoteDatabase<Record<string, never>>
  );

  return Layer.mergeAll(
    UserService.Default,
    UserProfileService.Default.pipe(Layer.provide(IdGenerator.TestSequence)),
    CustomerService.Default,
    InvoiceService.Default,
    DashboardService.Default
  ).pipe(Layer.provide(TestPgDrizzleLayer));
};

/**
 * DB テスト用カスタム it.effect
 *
 * - withRollback による自動ロールバック
 * - factory の自動提供
 * - Effect を直接返せる（Either.isRight 不要）
 *
 * @example
 * dbEffect("正常系: プロフィールを返す", ({ factory: f }) =>
 *   Effect.gen(function* () {
 *     const user = await f.user.create();
 *     const service = yield* UserProfileService;
 *     const profile = yield* service.findByUserId(user.id);
 *     expect(profile.userId).toBe(user.id);
 *   })
 * );
 */
export const dbEffect = (
  name: string,
  fn: (ctx: DbTestContext) => Effect.Effect<void, unknown, ServiceLayer>,
  timeout?: number
) => {
  vitestIt(
    name,
    async () => {
      factory.resetSequence();
      await withRollback(async (tx) => {
        const f = factory(tx);
        const TestServiceLayer = createTestServiceLayer(tx);
        await Effect.runPromise(
          fn({ tx, factory: f }).pipe(Effect.provide(TestServiceLayer))
        );
      });
    },
    timeout
  );
};

dbEffect.skip = (
  name: string,
  _fn: (ctx: DbTestContext) => Effect.Effect<void, unknown, ServiceLayer>,
  timeout?: number
) => {
  vitestIt.skip(name, async () => {}, timeout);
};

dbEffect.only = (
  name: string,
  fn: (ctx: DbTestContext) => Effect.Effect<void, unknown, ServiceLayer>,
  timeout?: number
) => {
  vitestIt.only(
    name,
    async () => {
      factory.resetSequence();
      await withRollback(async (tx) => {
        const f = factory(tx);
        const TestServiceLayer = createTestServiceLayer(tx);
        await Effect.runPromise(
          fn({ tx, factory: f }).pipe(Effect.provide(TestServiceLayer))
        );
      });
    },
    timeout
  );
};
