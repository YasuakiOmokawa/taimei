import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { Context, Schema } from "effect";
import type * as schema from "@/db/drizzle/schema";

// テストで rollback 用 transaction を差し込めるよう PgDatabase (NodePgDatabase と PgTransaction の共通基底) で受ける。
// @effect/sql-drizzle は v4 版が無いため drizzle を直接注入する。
export class Db extends Context.Service<
  Db,
  PgDatabase<NodePgQueryResultHKT, typeof schema>
>()("taimei/src/services/Db") {}

export class DbUnavailable extends Schema.TaggedError<DbUnavailable>()(
  "DbUnavailable",
  {
    cause: Schema.Defect(),
  },
) {}
