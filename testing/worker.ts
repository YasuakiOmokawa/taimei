import { buildDevHomeUrl } from "@taimei-code/auth-client/testing";
import type { ExecutionContext } from "hono";
import type { Env } from "@/src/app";
import { SERVICE_NAME } from "@/src/auth";
import production from "@/src/worker";

export { CompanyTeamListDurableObject } from "@/src/worker";

export default {
  ...production,
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => {
    const url = new URL(request.url);
    if (request.method !== "GET" || url.pathname !== "/dev-home")
      return production.fetch(request, env, ctx);
    return Response.redirect(
      buildDevHomeUrl({
        authBaseUrl: env.AUTH_URL,
        service: SERVICE_NAME,
        returnTo: `${url.origin}/`,
      }),
    );
  },
};
