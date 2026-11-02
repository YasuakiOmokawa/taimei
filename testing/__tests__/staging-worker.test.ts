import type { ExecutionContext } from "hono";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Env } from "@/src/app";
import { TEST_DATABASE_URL } from "@/src/services/__tests__/db/global-setup";
import { testDb } from "@/src/services/__tests__/db/test-db";
import { emptyTeamListStore } from "@/src/services/__tests__/request";

vi.mock("@sentry/cloudflare", () => ({
  withSentry: (_options: unknown, wrapped: unknown) => wrapped,
  captureException: vi.fn(),
  httpServerIntegration: vi.fn(),
  consoleIntegration: vi.fn(),
}));
vi.mock("@/src/lib/purge-departed", () => ({ purgeDeparted: vi.fn() }));

const ORIGIN = "https://taimei-staging.example";
const VERSION_ID = "version-1";

const loadEntries = async () => {
  vi.resetModules();
  const nonProduction = (await import("../worker")).default;
  const staging = await import("../staging-worker");
  const { purgeDeparted } = await import("@/src/lib/purge-departed");
  const production = await import("@/src/worker");
  return { nonProduction, staging, purgeDeparted, production };
};

const stagingEnv = (get: () => Promise<string>) => ({
  HYPERDRIVE: { connectionString: TEST_DATABASE_URL },
  AUTH: { fetch: vi.fn() },
  AUTH_URL: "https://taimei-auth-staging.example",
  AUTH_SERVICE_KEY: { get: vi.fn(get) },
  CF_VERSION_METADATA: { id: VERSION_ID },
  COMPANY_TEAM_LIST: { getByName: () => emptyTeamListStore() },
});

const collectingContext = () => {
  const waited: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: (promise: Promise<unknown>) => waited.push(promise),
    passThroughOnException: () => {},
    props: {},
  } as ExecutionContext;
  return { ctx, settled: () => Promise.allSettled(waited) };
};

const markDatabase = () =>
  testDb.execute(
    "CREATE TABLE IF NOT EXISTS non_production_database (marked_at timestamptz NOT NULL DEFAULT now())",
  );
const unmarkDatabase = () =>
  testDb.execute("DROP TABLE IF EXISTS non_production_database");

const devHome = () => new Request(`${ORIGIN}/dev-home`);

beforeEach(unmarkDatabase);
afterEach(async () => {
  vi.restoreAllMocks();
  await unmarkDatabase();
});

it("印の表が無い DB では、staging の入口の fetch は本番以外の入口を呼ばずに失敗する", async () => {
  const { nonProduction, staging } = await loadEntries();
  const passed = vi.spyOn(nonProduction, "fetch");
  const { ctx, settled } = collectingContext();

  await expect(
    staging.default.fetch(
      devHome(),
      stagingEnv(async () => "key"),
      ctx,
    ),
  ).rejects.toThrow("non_production_database");
  await settled();

  expect(passed).not.toHaveBeenCalled();
});

it("印の表が無い DB では、staging の入口の定期処理は purgeDeparted を呼ばずに失敗する", async () => {
  const { staging, purgeDeparted } = await loadEntries();
  const { ctx, settled } = collectingContext();

  await expect(
    staging.default.scheduled(
      {},
      stagingEnv(async () => "key"),
      ctx,
    ),
  ).rejects.toThrow("non_production_database");
  await settled();

  expect(purgeDeparted).not.toHaveBeenCalled();
});

it("印の表がある DB では、Secrets Store の AUTH_SERVICE_KEY を文字列に解いた env を本番以外の入口に渡し、GET /dev-home は 302", async () => {
  await markDatabase();
  const { nonProduction, staging } = await loadEntries();
  const passed = vi.spyOn(nonProduction, "fetch");
  const { ctx, settled } = collectingContext();

  const response = await staging.default.fetch(
    devHome(),
    stagingEnv(async () => "service-key"),
    ctx,
  );
  await settled();

  expect(response.status).toBe(302);
  const [, passedEnv] = passed.mock.calls[0];
  expect((passedEnv as Env).AUTH_SERVICE_KEY).toBe("service-key");
});

it("AUTH_SERVICE_KEY を解けなかった次の要求で、もう一度解いて応答する", async () => {
  await markDatabase();
  const { staging } = await loadEntries();
  const get = vi
    .fn<() => Promise<string>>()
    .mockRejectedValueOnce(new Error("secrets store down"))
    .mockResolvedValue("service-key");
  const env = { ...stagingEnv(async () => ""), AUTH_SERVICE_KEY: { get } };
  const first = collectingContext();
  const second = collectingContext();

  await expect(
    staging.default.fetch(devHome(), env, first.ctx),
  ).rejects.toThrow("secrets store down");
  const response = await staging.default.fetch(devHome(), env, second.ctx);
  await Promise.all([first.settled(), second.settled()]);

  expect(get).toHaveBeenCalledTimes(2);
  expect(response.status).toBe(302);
});

it("staging の入口の応答は、smoke が新しい version を見分ける Taimei-Staging-Version に version の id を持つ", async () => {
  await markDatabase();
  const { staging } = await loadEntries();
  const { ctx, settled } = collectingContext();

  const response = await staging.default.fetch(
    devHome(),
    stagingEnv(async () => "service-key"),
    ctx,
  );
  await settled();

  expect(response.headers.get("Taimei-Staging-Version")).toBe(VERSION_ID);
});

it("staging の入口の module は handler と本番の入口と同じ Durable Object の class だけを export する (ほかの値を export すると workerd が起動しない)", async () => {
  const { staging, production } = await loadEntries();

  expect(Object.keys(staging).sort()).toEqual([
    "CompanyTeamListDurableObject",
    "default",
  ]);
  expect(staging.CompanyTeamListDurableObject).toBe(
    production.CompanyTeamListDurableObject,
  );
});

it("印の表が無い DB では、requireMarkedDatabase は表の名前と runbook を示して失敗し、表を作ると通る", async () => {
  const { ctx, settled } = collectingContext();
  vi.resetModules();
  const { requireMarkedDatabase } = await import("../non-production-database");
  // biome-ignore lint/style/noRestrictedImports: 印の確認を Worker と同じ要求ごとの Pool の中で流す
  const { runWithRequestPool } = await import("@/db/drizzle/pool");
  const check = () =>
    runWithRequestPool(
      TEST_DATABASE_URL,
      (promise) => ctx.waitUntil(promise),
      requireMarkedDatabase,
    );

  await expect(check()).rejects.toThrow(
    /non_production_database[\s\S]*docs\/runbook\/staging\.md/,
  );
  await markDatabase();
  await expect(check()).resolves.toBeUndefined();
  await settled();
});
