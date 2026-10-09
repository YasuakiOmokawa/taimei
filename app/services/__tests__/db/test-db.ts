import { type ExtractTablesWithRelations, sql } from "drizzle-orm";
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

export const currentCompanySetting = async (db: Pick<TestDb, "execute">) => {
  const { rows } = await db.execute<{ company_id: string | null }>(
    sql`select current_setting(${COMPANY_ID_SETTING}, true) as company_id`,
  );
  return rows[0]?.company_id;
};

// superuser の postgres は RLS を常に bypass するので、BYPASSRLS の無い role に切り替えて policy を観測する
export const switchToRoleWithoutRlsBypass = async (tx: TestDb) => {
  const role = `rls_probe_${crypto.randomUUID().slice(0, 8)}`;
  await tx.execute(sql.raw(`CREATE ROLE "${role}" NOLOGIN`));
  await tx.execute(sql.raw(`GRANT USAGE ON SCHEMA public TO "${role}"`));
  await tx.execute(
    sql.raw(
      `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "${role}"`,
    ),
  );
  await tx.execute(sql.raw(`SET LOCAL ROLE "${role}"`));
};
