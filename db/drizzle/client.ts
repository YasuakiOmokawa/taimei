import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
// biome-ignore lint/style/noRestrictedImports: db の query を要求の Pool か DATABASE_URL の Pool に振り分ける
import { currentPool } from "./pool";
import * as schema from "./schema";

// drizzle は instanceof Pool のときだけ transaction の接続を connect() で取る
class RoutingPool extends Pool {
  override query = ((...args: Parameters<Pool["query"]>) =>
    currentPool().query(...args)) as Pool["query"];
  override connect = ((...args: Parameters<Pool["connect"]>) =>
    currentPool().connect(...args)) as Pool["connect"];
}

export const db = drizzle(new RoutingPool(), { schema });
