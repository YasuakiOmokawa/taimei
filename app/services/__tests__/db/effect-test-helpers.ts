import { it as vitestIt } from "@effect/vitest";
import { Effect } from "effect";
import { Db } from "../../db-service";
import { factory } from "../factories";
import { type TestDb, withRollback } from "./test-db";

export type TestFactory = ReturnType<typeof factory>;

export interface DbTestContext {
  tx: TestDb;
  factory: TestFactory;
}

export const dbEffect = (
  name: string,
  fn: (ctx: DbTestContext) => Effect.Effect<void, unknown, Db>,
  timeout?: number,
) => {
  vitestIt(
    name,
    async () => {
      factory.resetSequence();
      await withRollback(async (tx) => {
        const f = factory(tx);
        await Effect.runPromise(
          fn({ tx, factory: f }).pipe(Effect.provideService(Db, tx)),
        );
      });
    },
    timeout,
  );
};
