import { it as vitestIt } from "@effect/vitest";
import { Effect, Layer } from "effect";
import { AccountValidationService } from "../../account-validation-service";
import { AuthClient } from "../../auth-client-service";
import { CustomerService } from "../../customer-service";
import { DashboardService } from "../../dashboard-service";
import { Db } from "../../db-service";
import { InvoiceService } from "../../invoice-service";
import { Tag2Service } from "../../tag2-service";
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
  | CustomerService
  | InvoiceService
  | DashboardService
  | Tag2Service
  | AccountValidationService;

const createTestServiceLayer = (tx: TestDb) => {
  // 実 RPC を叩く AuthClient.layer。RPC 結果を検証するテストでは AuthClient.layerTest に差し替える。
  const UserServiceLayer = UserService.layer.pipe(
    Layer.provide(AuthClient.layer),
  );

  return Layer.mergeAll(
    UserServiceLayer,
    CustomerService.layer,
    InvoiceService.layer,
    DashboardService.layer,
    Tag2Service.layer,
    AccountValidationService.layer.pipe(Layer.provide(UserServiceLayer)),
  ).pipe(Layer.provide(Layer.succeed(Db, tx)));
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
