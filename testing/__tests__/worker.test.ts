import { readFileSync } from "node:fs";
import { buildDevHomeUrl } from "@taimei-code/auth-client/testing";
import type { ExecutionContext } from "hono";
import { expect, it, vi } from "vitest";
import { createApp, type Env } from "@/src/app";
import { afterSignInUrl, SERVICE_NAME } from "@/src/auth";
import production from "@/src/worker";
import nonProduction from "../worker";

vi.mock("@sentry/cloudflare", () => ({
  withSentry: (_options: unknown, wrapped: unknown) => wrapped,
  captureException: vi.fn(),
  httpServerIntegration: vi.fn(),
  consoleIntegration: vi.fn(),
}));

const ORIGIN = "http://app.example.localhost:3001";
const env = { AUTH_URL: "http://auth.example.localhost:3100" } as Env;
const ctx = {} as ExecutionContext;

it("開発者ホームの入口は、ログインと同じ after-signin を戻り先にした開発者ホームへ移す", async () => {
  const res = await nonProduction.fetch(
    new Request(`${ORIGIN}/dev-home`),
    env,
    ctx,
  );
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe(
    buildDevHomeUrl({
      authBaseUrl: env.AUTH_URL,
      service: SERVICE_NAME,
      returnTo: afterSignInUrl(ORIGIN, undefined),
    }),
  );
});

it("本番以外の入口は、開発者ホームの入口のほかに本番の入口と同じ handler を持つ", () => {
  expect(nonProduction.scheduled).toBe(production.scheduled);
});

it("開発者ホームの入口の path は run_worker_first に当たる (外れると Static Assets が index.html を返す)", () => {
  const config = JSON.parse(
    readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n"),
  );
  expect(config.assets.run_worker_first).toContain("/dev-home");
});

it("本番の app は開発者ホームの入口を持たない", () => {
  expect(
    createApp(() => {
      throw new Error("session を見ない");
    }).routes.filter(({ path }) => path === "/dev-home"),
  ).toEqual([]);
});
