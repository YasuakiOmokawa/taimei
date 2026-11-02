import { sql } from "drizzle-orm";
import { db } from "@/db/drizzle/client";

export const requireMarkedDatabase = async () => {
  const { rows } = await db.execute<{ marked: boolean }>(
    sql`SELECT to_regclass('public.non_production_database') IS NOT NULL AS marked`,
  );
  if (rows[0]?.marked) return;
  throw new Error(
    "DB に本番以外の DB の印の表 (public.non_production_database) が無い。本番の DB につながっていないかを確かめ、docs/runbook/staging.md の SQL で印を付けた DB に向ける",
  );
};
