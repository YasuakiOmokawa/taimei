import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { it as vitestIt } from "@effect/vitest";
import type { PgRemoteDatabase } from "drizzle-orm/pg-proxy";
import { Effect, Layer } from "effect";
import { AccountValidationService } from "../../account-validation-service";
import { AuthClient } from "../../auth-client-service";
import { CustomerService } from "../../customer-service";
import { DashboardService } from "../../dashboard-service";
import { IdGenerator } from "../../id-generator-service";
import { InvoiceService } from "../../invoice-service";
import { UserProfileService } from "../../user-profile-service";
import { UserService } from "../../user-service";
import { factory } from "../factories";
import { type TestDb, withRollback } from "./test-db";

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
  | DashboardService
  | AccountValidationService;

const createTestServiceLayer = (tx: TestDb) => {
  const TestPgDrizzleLayer = Layer.succeed(
    PgDrizzle.PgDrizzle,
    tx as unknown as PgRemoteDatabase<Record<string, never>>,
  );

  // UserService は ConnectRPC に移行済みのため PgDrizzle 不要、AuthClient.Default を提供する。
  // テスト helper では実 RPC を呼ぶ AuthClient.Default を使用 (現状 user-service の DB テストは
  // RPC 呼出を直接検証していないため Mock 不要)。
  // Phase 2.5 で AuthClient.Custom 経由の RPC 結果分岐網羅テストは
  // app/services/__tests__/auth-service-integration.test.ts に集約。
  // 将来 user-service に RPC 検証を伴うテストを追加する際は、AuthClient.Default ではなく
  // AuthClient.Custom で差し替えること (実 RPC を silent に叩くのを防ぐため)。
  const AuthClientLayer = AuthClient.Default;
  const UserServiceLayer = UserService.Default.pipe(
    Layer.provide(AuthClientLayer),
  );

  return Layer.mergeAll(
    UserServiceLayer,
    UserProfileService.Default.pipe(Layer.provide(IdGenerator.TestSequence)),
    CustomerService.Default,
    InvoiceService.Default,
    DashboardService.Default,
    AccountValidationService.Default.pipe(Layer.provide(UserServiceLayer)),
  ).pipe(Layer.provide(TestPgDrizzleLayer));
};

export const dbEffect = (
  name: string,
  fn: (ctx: DbTestContext) => Effect.Effect<void, unknown, ServiceLayer>,
  timeout?: number,
) => {
  vitestIt(
    name,
    async () => {
      factory.resetSequence();
      await withRollback(async (tx) => {
        const f = factory(tx);
        const TestServiceLayer = createTestServiceLayer(tx);
        await Effect.runPromise(
          fn({ tx, factory: f }).pipe(Effect.provide(TestServiceLayer)),
        );
      });
    },
    timeout,
  );
};

dbEffect.skip = (
  name: string,
  _fn: (ctx: DbTestContext) => Effect.Effect<void, unknown, ServiceLayer>,
  timeout?: number,
) => {
  vitestIt.skip(name, async () => {}, timeout);
};

dbEffect.only = (
  name: string,
  fn: (ctx: DbTestContext) => Effect.Effect<void, unknown, ServiceLayer>,
  timeout?: number,
) => {
  vitestIt.only(
    name,
    async () => {
      factory.resetSequence();
      await withRollback(async (tx) => {
        const f = factory(tx);
        const TestServiceLayer = createTestServiceLayer(tx);
        await Effect.runPromise(
          fn({ tx, factory: f }).pipe(Effect.provide(TestServiceLayer)),
        );
      });
    },
    timeout,
  );
};
