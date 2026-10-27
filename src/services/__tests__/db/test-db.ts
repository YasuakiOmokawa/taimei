import { type ExtractTablesWithRelations, type SQL, sql } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "@/db/drizzle/schema";
import { COMPANY_ID_SETTING } from "@/db/drizzle/schema";
import { TEST_DATABASE_URL } from "./global-setup";

const testDb = drizzle(new Pool({ connectionString: TEST_DATABASE_URL }), {
  schema,
});

type Schema = typeof schema;
export type TestDb = PgTransaction<
  NodePgQueryResultHKT,
  Schema,
  ExtractTablesWithRelations<Schema>
>;

const rollback = Symbol("rollback");

// drizzle に rollback だけの API が無いので、throw で transaction を中断して巻き戻す
export const withRollback = async (fn: (tx: TestDb) => Promise<void>) => {
  await testDb
    .transaction(async (tx) => {
      await fn(tx);
      throw rollback;
    })
    .catch((e: unknown) => {
      if (e !== rollback) throw e;
    });
};

let rollbackTx: TestDb | undefined;

const currentRollbackTx = () => {
  if (!rollbackTx) throw new Error("withRollbackDb の外で db を使った");
  return rollbackTx;
};

let lastQueued: Promise<unknown> = Promise.resolve();

// pg は 1 本の接続に重ねた query を deprecated とし、pg@9 で失敗させる
const oneAtATime = <T>(run: () => PromiseLike<T>): Promise<T> => {
  const queued = lastQueued.then(run);
  lastQueued = queued.catch(() => undefined);
  return queued;
};

export const APP_ROLE = "taimei_app";

export const asAppRole = <T>(tx: TestDb, fn: (app: TestDb) => Promise<T>) =>
  tx.transaction(async (app) => {
    await app.execute(sql.raw(`SET LOCAL ROLE ${APP_ROLE}`));
    const result = await fn(app);
    await app.execute(sql`RESET ROLE`);
    return result;
  });

const inCurrentRollbackAsApp = <T>(fn: (app: TestDb) => Promise<T>) => {
  const tx = currentRollbackTx();
  return oneAtATime(() => asAppRole(tx, fn));
};

export const dbInRollback: Pick<TestDb, "transaction" | "execute"> = {
  transaction: (fn) => inCurrentRollbackAsApp(fn),
  execute: ((query) =>
    inCurrentRollbackAsApp((app) => app.execute(query))) as TestDb["execute"],
};

export const withRollbackDb = (fn: (tx: TestDb) => Promise<void>) =>
  withRollback(async (tx) => {
    rollbackTx = tx;
    try {
      await fn(tx);
    } finally {
      await lastQueued;
      rollbackTx = undefined;
    }
  });

export const functionValue = async (db: Pick<TestDb, "execute">, call: SQL) => {
  const { rows } = await db.execute<{ value: unknown }>(
    sql`select ${call} as value`,
  );
  return rows[0]?.value;
};

export const teamListVersion = async (
  db: Pick<TestDb, "execute">,
  companyId: string,
) =>
  (
    (await functionValue(db, sql`company_team_list(${companyId})`)) as {
      version: number;
    }
  ).version;

export const currentCompanySetting = async (db: Pick<TestDb, "execute">) => {
  const { rows } = await db.execute<{ company_id: string | null }>(
    sql`select current_setting(${COMPANY_ID_SETTING}, true) as company_id`,
  );
  return rows[0]?.company_id;
};
