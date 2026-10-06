import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import { drizzle } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import * as schema from "@/db/drizzle/schema";
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
