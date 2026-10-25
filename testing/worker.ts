import { buildDevHomeUrl } from "@taimei-code/auth-client/testing";
import type { ExecutionContext } from "hono";
import type { Env } from "@/src/app";
import { afterSignInUrl, SERVICE_NAME } from "@/src/auth";
import production from "@/src/worker";

export { CompanyTeamListDurableObject } from "@/src/worker";

const DEV_HOME_PATH = "/dev-home";

export default {
  ...production,
  fetch: (request: Request, env: Env, ctx: ExecutionContext) => {
    const url = new URL(request.url);
    if (request.method !== "GET" || url.pathname !== DEV_HOME_PATH)
      return production.fetch(request, env, ctx);
    return Response.redirect(
      buildDevHomeUrl({
        authBaseUrl: env.AUTH_URL,
        service: SERVICE_NAME,
        returnTo: afterSignInUrl(url.origin, undefined),
      }),
      302,
    );
  },
};
