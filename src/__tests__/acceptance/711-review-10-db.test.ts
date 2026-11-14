import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  COMPANY_A,
  COMPANY_B,
  seedTeam,
} from "@/src/services/__tests__/db/seed";
import {
  functionValue,
  type TestDb,
  withCommitCheck,
  withRollback,
} from "@/src/services/__tests__/db/test-db";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const SLOW_TEST_TIMEOUT = 240_000;

const commitChecked = (tx: TestDb, write: (sp: TestDb) => Promise<unknown>) =>
  tx.transaction((sp) => withCommitCheck(sp, write).then(() => undefined));

const bump = (sp: TestDb, companyId: string) =>
  functionValue(sp, sql`bump_company_team_list(${companyId})`);

describe("#711 10-1 一覧の元の表を書いた transaction の commit は、書いた事業所ごとの bump を要求する", () => {
  it("AC-001 事業所 A の teams を書き、事業所 B だけを bump した transaction は commit の検査で落ち、失敗の文言が事業所 A の id を含む", () =>
    withRollback(async (tx) => {
      await expect(
        commitChecked(tx, async (sp) => {
          await seedTeam(sp, COMPANY_A, "A のチーム");
          await bump(sp, COMPANY_B);
        }),
      ).rejects.toMatchObject({
        cause: { message: expect.stringContaining(COMPANY_A) },
      });
    }));

  it("AC-002 事業所 A と事業所 B の teams を書き、両方を bump した transaction は commit の検査を通る", () =>
    withRollback(async (tx) => {
      await expect(
        commitChecked(tx, async (sp) => {
          await seedTeam(sp, COMPANY_A, "A のチーム");
          await seedTeam(sp, COMPANY_B, "B のチーム");
          await bump(sp, COMPANY_A);
          await bump(sp, COMPANY_B);
        }),
      ).resolves.toBeUndefined();
    }));

  it("AC-003 事業所 A の teams を書き、事業所 A を bump した transaction は commit の検査を通る", () =>
    withRollback(async (tx) => {
      await expect(
        commitChecked(tx, async (sp) => {
          await seedTeam(sp, COMPANY_A, "A のチーム");
          await bump(sp, COMPANY_A);
        }),
      ).resolves.toBeUndefined();
    }));
});

const temporaryDirs: string[] = [];
afterAll(() => {
  for (const dir of temporaryDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const COPIED_DIRS = new Set(["src", "db", "drizzle"]);
const SKIPPED_IN_COPY = new Set(["node_modules"]);
const ACCEPTANCE_DIR = "src/__tests__/acceptance";
const DESTRUCTIVE_MIGRATION = "9999_acceptance_drop_teams.sql";

const repoCopyWithDestructiveMigration = () => {
  const copy = mkdtempSync(path.join(tmpdir(), "taimei-711-db-"));
  temporaryDirs.push(copy);
  for (const entry of readdirSync(REPO_ROOT)) {
    if (SKIPPED_IN_COPY.has(entry)) {
      continue;
    }
    const source = path.join(REPO_ROOT, entry);
    const target = path.join(copy, entry);
    if (COPIED_DIRS.has(entry)) {
      cpSync(source, target, { recursive: true });
    } else if (statSync(source).isFile()) {
      copyFileSync(source, target);
    } else {
      symlinkSync(source, target);
    }
  }
  rmSync(path.join(copy, ACCEPTANCE_DIR), { recursive: true, force: true });
  mkdirSync(path.join(copy, "node_modules"));
  for (const entry of readdirSync(path.join(REPO_ROOT, "node_modules"))) {
    if (entry !== ".cache") {
      symlinkSync(
        path.join(REPO_ROOT, "node_modules", entry),
        path.join(copy, "node_modules", entry),
      );
    }
  }
  writeFileSync(
    path.join(copy, "drizzle", DESTRUCTIVE_MIGRATION),
    'DROP TABLE "teams";\n',
  );
  return copy;
};

describe("#711 10-2 行や列を消す migration", () => {
  it(
    "AC-004 drizzle/ に DROP TABLE の文を持つ migration の file を足すと、server の試験がその file の名前を挙げて落ちる",
    () => {
      const copy = repoCopyWithDestructiveMigration();

      const result = spawnSync(
        "bunx",
        ["vitest", "run", "--project", "server"],
        { cwd: copy, encoding: "utf8" },
      );

      expect({
        failed: result.status !== 0,
        namesMigration: `${result.stdout}${result.stderr}`.includes(
          DESTRUCTIVE_MIGRATION,
        ),
      }).toEqual({ failed: true, namesMigration: true });
    },
    SLOW_TEST_TIMEOUT,
  );
});

const TRANSACTION_ABORTED = "25P02";
const selectOne = (tx: TestDb) => tx.execute(sql`select 1 as one`);

describe("#711 10-8 試験を書く時に踏む Postgres の挙動", () => {
  it("AC-021 一意制約の違反は、savepoint の外で起こすと transaction ごと中断する", () =>
    withRollback(async (tx) => {
      await seedTeam(tx, COMPANY_A, "同じ名前");

      await expect(seedTeam(tx, COMPANY_A, "同じ名前")).rejects.toThrow();

      await expect(selectOne(tx)).rejects.toMatchObject({
        cause: { code: TRANSACTION_ABORTED },
      });
    }));

  it("AC-021 一意制約の違反は、savepoint の中で起こすと外側の transaction は続けられる", () =>
    withRollback(async (tx) => {
      await seedTeam(tx, COMPANY_A, "同じ名前");

      await expect(
        tx.transaction((sp) => seedTeam(sp, COMPANY_A, "同じ名前")),
      ).rejects.toThrow();

      expect((await selectOne(tx)).rows).toEqual([{ one: 1 }]);
    }));

  it("AC-022 set_config(…, true) で設定した値は、savepoint を抜けても外側の transaction の終わりまで残る", () =>
    withRollback(async (tx) => {
      await tx.transaction((sp) =>
        sp.execute(
          sql`select set_config('app.acceptance_711', 'savepoint の中で設定', true)`,
        ),
      );

      const { rows } = await tx.execute(
        sql`select current_setting('app.acceptance_711', true) as value`,
      );

      expect(rows).toEqual([{ value: "savepoint の中で設定" }]);
    }));
});
