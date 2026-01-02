import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import { Pool } from "pg";
import * as schema from "@/db/drizzle/schema";

const TEST_DATABASE_URL =
  process.env.DATABASE_URL ||
  "postgresql://postgres:password@localhost:5434/taimei_test";

const pool = new Pool({ connectionString: TEST_DATABASE_URL });
export const testDb = drizzle(pool, { schema });

type Schema = typeof schema;
export type TestDb =
  | NodePgDatabase<Schema>
  | PgTransaction<NodePgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;

/**
 * RSpec の transactional fixtures 相当。テスト間のデータ分離を実現。
 * TRUNCATE より高速（トランザクション中断のみ）
 */
export async function withRollback<T>(
  fn: (tx: TestDb) => Promise<T>
): Promise<T> {
  return await testDb
    .transaction(async (tx) => {
      const result = await fn(tx);
      // Drizzle にロールバック専用 API がないため、例外で中断
      throw { __rollback: true, result };
    })
    .catch((e: unknown) => {
      if (
        e &&
        typeof e === "object" &&
        "__rollback" in e &&
        (e as { __rollback: boolean }).__rollback
      ) {
        return (e as { __rollback: boolean; result: T }).result;
      }
      throw e;
    });
}
