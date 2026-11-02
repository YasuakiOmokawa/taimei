import type { ExecutionContext } from "hono";
// biome-ignore lint/style/noRestrictedImports: staging の Worker の入口は、印の確認を要求ごとの Pool の中で流す
import { runWithRequestPool } from "@/db/drizzle/pool";
import type { Env } from "@/src/app";
import { requireMarkedDatabase } from "./non-production-database";
import nonProduction from "./worker";

export { CompanyTeamListDurableObject } from "@/src/worker";

type StagingEnv = Omit<Env, "AUTH_SERVICE_KEY"> & {
  readonly AUTH_SERVICE_KEY: { get(): Promise<string> };
};

const VERSION_HEADER = "Taimei-Staging-Version";

let authServiceKeyOnMarkedDatabase: Promise<string> | undefined;

const envOnMarkedDatabase = async (
  env: StagingEnv,
  ctx: ExecutionContext,
): Promise<Env> => {
  authServiceKeyOnMarkedDatabase ??= Promise.all([
    runWithRequestPool(
      env.HYPERDRIVE.connectionString,
      (promise) => ctx.waitUntil(promise),
      requireMarkedDatabase,
    ),
    env.AUTH_SERVICE_KEY.get(),
  ])
    .then(([, authServiceKey]) => authServiceKey)
    .catch((error: unknown) => {
      authServiceKeyOnMarkedDatabase = undefined;
      throw error;
    });
  ctx.waitUntil(authServiceKeyOnMarkedDatabase);
  return { ...env, AUTH_SERVICE_KEY: await authServiceKeyOnMarkedDatabase };
};

export default {
  fetch: async (request: Request, env: StagingEnv, ctx: ExecutionContext) => {
    const response = await nonProduction.fetch(
      request,
      await envOnMarkedDatabase(env, ctx),
      ctx,
    );
    const versioned = new Response(response.body, response);
    versioned.headers.set(VERSION_HEADER, env.CF_VERSION_METADATA.id);
    return versioned;
  },
  scheduled: async (
    controller: unknown,
    env: StagingEnv,
    ctx: ExecutionContext,
  ) =>
    nonProduction.scheduled(
      controller,
      await envOnMarkedDatabase(env, ctx),
      ctx,
    ),
};
