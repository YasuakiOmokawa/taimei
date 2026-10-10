import { sql } from "drizzle-orm";
import { afterEach, expect, it, vi } from "vitest";
import { TEST_DATABASE_URL } from "@/app/services/__tests__/db/global-setup";

const urlNamed = (applicationName: string) => {
  const url = new URL(TEST_DATABASE_URL);
  url.searchParams.set("application_name", applicationName);
  return url.toString();
};

const applicationNameOf = async (db: {
  execute: (query: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }>;
}) =>
  (await db.execute(sql`select current_setting('application_name') as name`))
    .rows[0];

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

it("db は runWithRequestPool の中ではその Pool に、外では DATABASE_URL の Pool に繋ぐ", async () => {
  vi.stubEnv("DATABASE_URL", urlNamed("singleton"));
  const { db, runWithRequestPool } = await import("../drizzle/client");

  expect(await applicationNameOf(db)).toEqual({ name: "singleton" });
  await runWithRequestPool(urlNamed("request"), async (pool) => {
    try {
      expect(await applicationNameOf(db)).toEqual({ name: "request" });
      expect(await db.transaction((tx) => applicationNameOf(tx))).toEqual({
        name: "request",
      });
    } finally {
      await pool.end();
    }
  });
});

it("DATABASE_URL も request の Pool も無ければ、query は失敗する", async () => {
  vi.stubEnv("DATABASE_URL", undefined);
  const { db } = await import("../drizzle/client");

  await expect(applicationNameOf(db)).rejects.toThrow();
});
