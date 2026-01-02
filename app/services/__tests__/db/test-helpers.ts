import { factory } from "../factories";
import { testDb, withRollback, type TestDb } from "./test-db";
import { beforeEach } from "vitest";
import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { Effect, Either, Layer } from "effect";
import { UserService } from "../../user-service";
import { UserProfileService } from "../../user-profile-service";
import { CustomerService } from "../../customer-service";
import { InvoiceService } from "../../invoice-service";
import { DashboardService } from "../../dashboard-service";
import { IdGenerator } from "../../id-generator-service";
import type { PgRemoteDatabase } from "drizzle-orm/pg-proxy";

/**
 * シーケンスリセットで ID の決定性を保証（test-user-1, test-user-2, ...）
 */
export function useFactoryReset() {
  beforeEach(() => {
    factory.resetSequence();
  });
}

export function getFactory(db: TestDb = testDb) {
  return factory(db);
}

/**
 * テスト用トランザクション環境でServiceを実行
 *
 * ## 型キャストについて
 * TestDb (drizzle-orm/node-postgres の NodePgDatabase) を
 * PgDrizzle.PgDrizzle (@effect/sql-drizzle の PgRemoteDatabase) にキャストしている。
 *
 * 両者は異なる Drizzle アダプター経由の型だが、クエリ API (.select(), .from() 等) は
 * 同一の drizzle-orm コアを使用しているため互換性がある。
 *
 * 型安全なアプローチ（@effect/sql-drizzle でテスト基盤を構築）も検討したが、
 * withRollback のトランザクション分離パターンの再実装が必要で複雑になるため、
 * シンプルなキャスト方式を採用。型の不整合があればテスト実行時に即検出される。
 */
export function runServiceWithTx<A, E>(
  tx: TestDb,
  effect: Effect.Effect<
    A,
    E,
    | UserService
    | UserProfileService
    | CustomerService
    | InvoiceService
    | DashboardService
  >
): Promise<Either.Either<A, E>> {
  const TestPgDrizzleLayer = Layer.succeed(
    PgDrizzle.PgDrizzle,
    tx as unknown as PgRemoteDatabase<Record<string, never>>
  );

  const TestServiceLayer = Layer.mergeAll(
    UserService.Default,
    UserProfileService.Default.pipe(Layer.provide(IdGenerator.TestSequence)),
    CustomerService.Default,
    InvoiceService.Default,
    DashboardService.Default
  ).pipe(Layer.provide(TestPgDrizzleLayer));

  return effect.pipe(
    Effect.provide(TestServiceLayer),
    Effect.either,
    Effect.runPromise
  );
}

export { withRollback, testDb, type TestDb };
