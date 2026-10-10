import { Effect, Schema } from "effect";
import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { createMiddleware } from "hono/factory";
import { isManager } from "@/src/services/authorization-context";
import { TeamService } from "@/src/services/team-service";
import {
  type AuthEnv,
  accountLocation,
  afterSignInLocation,
  afterSignUpLocation,
  loginLocation,
  requestSessionOf,
  sameOriginCallbackPath,
  verifySession,
} from "./auth";
import { encodedJson, runJson, type SessionVariables } from "./run-json";

export type Env = AuthEnv & {
  readonly HYPERDRIVE: { connectionString: string };
};
type AppEnv = { Bindings: Env } & SessionVariables;

const Me = Schema.Struct({ name: Schema.String, canManage: Schema.Boolean });
const Teams = Schema.Struct({
  teams: Schema.Array(
    Schema.Struct({ id: Schema.String, name: Schema.String }),
  ),
});

// 事業所の無い人も 401 にする。taimei-auth のログインの入口が事業所の登録へ送る
const requireSession = createMiddleware<AppEnv>(async (c, next) => {
  const verified = await verifySession(c.env, c.req.header("Cookie"));
  const session = verified.ok ? requestSessionOf(verified.data) : undefined;
  if (!session) return c.json({ _tag: "Unauthenticated" as const }, 401);
  c.set("session", session);
  await next();
});

const originOf = (url: string) => new URL(url).origin;

export const app = new Hono<AppEnv>()
  .use("/api/*", csrf())
  .use("/api/*", requireSession)
  .get("/api/me", (c) =>
    encodedJson(c, Me, {
      name: c.var.session.userName,
      canManage: isManager(c.var.session.role),
    }),
  )
  .get("/api/teams", (c) =>
    runJson(c, Teams, () =>
      TeamService.use((service) => service.listTeams).pipe(
        Effect.map((teams) => ({ teams })),
      ),
    ),
  )
  .get("/auth", (c) => {
    const origin = originOf(c.req.url);
    return c.redirect(
      loginLocation(
        c.env.AUTH_URL,
        origin,
        sameOriginCallbackPath(c.req.query("callbackUrl"), origin),
      ),
    );
  })
  .get("/auth/after-signin", async (c) => {
    const origin = originOf(c.req.url);
    return c.redirect(
      afterSignInLocation(
        await verifySession(c.env, c.req.header("Cookie")),
        c.env.AUTH_URL,
        origin,
        sameOriginCallbackPath(c.req.query("callbackUrl"), origin),
      ),
    );
  })
  .get("/auth/after-signup", async (c) =>
    c.redirect(
      afterSignUpLocation(
        await verifySession(c.env, c.req.header("Cookie")),
        c.env.AUTH_URL,
        originOf(c.req.url),
        Date.now(),
      ),
    ),
  )
  .get("/auth/account", (c) => c.redirect(accountLocation(c.env.AUTH_URL)));

export type AppType = typeof app;
