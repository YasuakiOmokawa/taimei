import { buildDevHomeUrl } from "@taimei-code/auth-client/testing";
import type { ExecutionContext } from "hono";
import { afterEach, expect, it, vi } from "vitest";
import type { Env } from "@/src/app";
import { SERVICE_NAME } from "@/src/auth";
import production, {
  CompanyTeamListDurableObject as ProductionDurableObject,
} from "@/src/worker";
import nonProduction, { CompanyTeamListDurableObject } from "../worker";

vi.mock("@sentry/cloudflare", () => ({
  withSentry: (_options: unknown, wrapped: unknown) => wrapped,
  captureException: vi.fn(),
  httpServerIntegration: vi.fn(),
  consoleIntegration: vi.fn(),
}));

const ORIGIN = "http://app.example.localhost:3001";
const env = { AUTH_URL: "http://auth.example.localhost:3100" } as Env;
const ctx = {} as ExecutionContext;

afterEach(() => {
  vi.restoreAllMocks();
});

it("本番以外の入口の GET /dev-home は、SDK の buildDevHomeUrl が組む、開いた origin のトップを戻り先にした開発者ホームへ 302 で移す", async () => {
  const response = await nonProduction.fetch(
    new Request(`${ORIGIN}/dev-home`),
    env,
    ctx,
  );

  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe(
    buildDevHomeUrl({
      authBaseUrl: env.AUTH_URL,
      service: SERVICE_NAME,
      returnTo: `${ORIGIN}/`,
    }),
  );
});

it.each([
  ["POST", "/dev-home"],
  ["GET", "/"],
])(
  "本番以外の入口は、GET /dev-home 以外の要求 (%s %s) を本番の入口の fetch に同じ引数で渡す",
  async (method, path) => {
    const passed = new Response("production");
    const fetch = vi.spyOn(production, "fetch").mockResolvedValue(passed);
    const request = new Request(`${ORIGIN}${path}`, { method });

    const response = await nonProduction.fetch(request, env, ctx);

    expect(fetch).toHaveBeenCalledExactlyOnceWith(request, env, ctx);
    expect(response).toBe(passed);
  },
);

it("本番以外の入口は、本番の入口と同じ scheduled と Durable Object の class を持つ", () => {
  expect(nonProduction.scheduled).toBe(production.scheduled);
  expect(CompanyTeamListDurableObject).toBe(ProductionDurableObject);
});
