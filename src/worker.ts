import type { ExecutionContext } from "hono";
// biome-ignore lint/style/noRestrictedImports: 要求ごとの Pool を開くのは Worker の入口だけ (db/CLAUDE.md)
import { runWithRequestPool } from "@/db/drizzle/pool";
import { app, type Env } from "./app";

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    runWithRequestPool(
      env.HYPERDRIVE.connectionString,
      (promise) => ctx.waitUntil(promise),
      async () => app.fetch(request, env, ctx),
    ),
};
