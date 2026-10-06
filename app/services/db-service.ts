import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { Context, Data } from "effect";
import { db } from "@/db/drizzle/client";
import type * as schema from "@/db/drizzle/schema";
import { withCompanyScope } from "@/db/scoped";

// テストで rollback 用 transaction を差し込めるよう PgDatabase (NodePgDatabase と PgTransaction の共通基底) で受ける。
// @effect/sql-drizzle は v4 版が無いため drizzle を直接注入する。
export class Db extends Context.Service<
  Db,
  PgDatabase<NodePgQueryResultHKT, typeof schema>
>()("services/Db") {
  static readonly inCompanyScope = <T>(
    companyId: string,
    fn: (tx: Db["Service"]) => Promise<T>,
  ) => withCompanyScope(db, companyId, fn);
}

export class DbUnavailable extends Data.TaggedError("DbUnavailable")<{
  cause: unknown;
}> {}
