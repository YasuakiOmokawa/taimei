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
import { AccountValidationService } from "../../account-validation-service";
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
  | DashboardService
  | AccountValidationService;

const createTestServiceLayer = (tx: TestDb) => {
  const TestPgDrizzleLayer = Layer.succeed(
    PgDrizzle.PgDrizzle,
    tx as unknown as PgRemoteDatabase<Record<string, never>>
  );

  const UserServiceLayer = UserService.Default.pipe(
    Layer.provide(TestPgDrizzleLayer)
  );

  return Layer.mergeAll(
    UserServiceLayer,
    UserProfileService.Default.pipe(Layer.provide(IdGenerator.TestSequence)),
    CustomerService.Default,
    InvoiceService.Default,
    DashboardService.Default,
    AccountValidationService.Default.pipe(Layer.provide(UserServiceLayer))
  ).pipe(Layer.provide(TestPgDrizzleLayer));
};

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
