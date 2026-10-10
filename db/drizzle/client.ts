import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// workerd は別の request で開いた socket を使い回せない (taimei-auth #91)。Workers は request ごとの Pool に振り分ける
const requestPoolStore = new AsyncLocalStorage<Pool>();
const singletonPool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : undefined;

const currentPool = () => {
  const pool = requestPoolStore.getStore() ?? singletonPool;
  if (!pool)
    throw new Error("DATABASE_URL も runWithRequestPool の Pool も無い");
  return pool;
};

// drizzle は instanceof Pool で transaction の接続を connect() で取るので、Pool を継承する
class RoutingPool extends Pool {
  override query = ((...args: Parameters<Pool["query"]>) =>
    currentPool().query(...args)) as Pool["query"];
  override connect = ((...args: Parameters<Pool["connect"]>) =>
    currentPool().connect(...args)) as Pool["connect"];
}

export const db = drizzle(new RoutingPool(), { schema });

// Pool を閉じるのは呼び手
export const runWithRequestPool = <T>(
  connectionString: string,
  fn: (pool: Pool) => T,
) => {
  const pool = new Pool({ connectionString });
  return requestPoolStore.run(pool, () => fn(pool));
};
