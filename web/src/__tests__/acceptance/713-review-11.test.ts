import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");
const SLOW_TEST_TIMEOUT = 240_000;

const run = (cwd: string, command: string, ...args: readonly string[]) => {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
  };
};

const gitGrepLines = (pattern: string, ...pathspecs: readonly string[]) => {
  const result = spawnSync(
    "git",
    ["grep", "--untracked", "-n", "-E", pattern, "--", ...pathspecs],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git grep ${pattern}: ${result.stderr}`);
  }
  return result.stdout.split("\n").filter((line) => line !== "");
};

const temporaryDirs: string[] = [];
afterAll(() => {
  for (const dir of temporaryDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const temporaryDir = (name: string) => {
  const dir = mkdtempSync(path.join(tmpdir(), `taimei-713-${name}-`));
  temporaryDirs.push(dir);
  return dir;
};

const COPIED_DIRS = new Set(["web", "src", "db", "infra"]);
const SKIPPED_IN_COPY = new Set(["node_modules"]);
const SKIPPED_IN_DIR_COPY = new Set(["dist", "tsconfig.tsbuildinfo"]);
const ACCEPTANCE_DIRS = [
  "web/src/__tests__/acceptance",
  "src/__tests__/acceptance",
];

const repoCopy = () => {
  const copy = temporaryDir("repo");
  for (const entry of readdirSync(REPO_ROOT)) {
    if (SKIPPED_IN_COPY.has(entry)) {
      continue;
    }
    const source = path.join(REPO_ROOT, entry);
    const target = path.join(copy, entry);
    if (COPIED_DIRS.has(entry)) {
      cpSync(source, target, {
        recursive: true,
        filter: (file) => !SKIPPED_IN_DIR_COPY.has(path.basename(file)),
      });
    } else if (statSync(source).isFile()) {
      copyFileSync(source, target);
    } else {
      symlinkSync(source, target);
    }
  }
  for (const dir of ACCEPTANCE_DIRS) {
    rmSync(path.join(copy, dir), { recursive: true, force: true });
  }
  mkdirSync(path.join(copy, "node_modules"));
  for (const entry of readdirSync(path.join(REPO_ROOT, "node_modules"))) {
    if (entry !== ".cache") {
      symlinkSync(
        path.join(REPO_ROOT, "node_modules", entry),
        path.join(copy, "node_modules", entry),
      );
    }
  }
  return copy;
};

const replaceIn = (copy: string, file: string, from: string, to: string) => {
  const before = readFileSync(path.join(copy, file), "utf8");
  const after = before.replace(from, to);
  if (after === before) {
    throw new Error(`${file} に ${from} が無い`);
  }
  writeFileSync(path.join(copy, file), after);
};

const CONTRACT = "src/spa-contract.ts";
const OPTIONAL_FIELD = "  acceptanceNote: Schema.optionalKey(Schema.String),\n";
const RECEIVED_LEVEL_LINE = "level: Level,\n";
const SENT_LEVEL_HEAD = "export const LevelEntry = Schema.Struct({\n";

const typecheckWithContractEdit = (from: string) => {
  const copy = repoCopy();
  replaceIn(copy, CONTRACT, from, `${from}${OPTIONAL_FIELD}`);
  const result = run(copy, "bun", "run", "typecheck");
  return {
    failed: result.status !== 0,
    typeErrors: result.output.includes("error TS"),
  };
};

describe("#713 11-1 レベルの 1 件の、送る形と受ける形", () => {
  it(
    "AC-001 契約の、レベルの 1 件を受ける形にだけ省ける field を足すと、bun run typecheck が落ちる",
    () => {
      expect(typecheckWithContractEdit(RECEIVED_LEVEL_LINE)).toEqual({
        failed: true,
        typeErrors: true,
      });
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "AC-002 契約の、レベルの 1 件を送る形 (LevelEntry) にだけ省ける field を足すと、bun run typecheck が落ちる",
    () => {
      expect(typecheckWithContractEdit(SENT_LEVEL_HEAD)).toEqual({
        failed: true,
        typeErrors: true,
      });
    },
    SLOW_TEST_TIMEOUT,
  );
});

const WEB_SOURCES_OUTSIDE_TESTS = [
  ":(glob)web/src/*.ts",
  ":(glob)web/src/app/*.ts",
  "web/src/app/dashboard",
  "web/src/app/public",
  ":(glob)web/src/dashboard/*.ts",
  "web/src/dashboard/pages",
  ":(glob)web/src/landing/*.ts",
  "web/src/landing/pages",
  ":(glob)web/src/privacy/*.ts",
  "web/src/privacy/pages",
  ":(glob)web/src/shared/*.ts",
  ":(glob)web/src/shared/ui/*.ts",
];

const RESPONSE_SHAPE_OF_CONTRACT = [
  "canManage: Schema\\.",
  "members: Schema\\.",
  "teams: Schema\\.Array",
  "email: Schema\\.String",
  'Schema\\.Literals\\(\\["OWNER"',
].join("|");

describe("#713 11-2 契約の応答の形", () => {
  it("AC-003 web/src の試験でない file で、契約が持つ応答の形 (canManage・members・teams・email の schema と、role の literal の列挙) を書かない", () => {
    expect(
      gitGrepLines(RESPONSE_SHAPE_OF_CONTRACT, ...WEB_SOURCES_OUTSIDE_TESTS),
    ).toEqual([]);
  });
});

const DROPS_FUNCTION = "9991_acceptance_drops_function.sql";
const RENAMES_COLUMN = "9992_acceptance_renames_column.sql";
const ADDS_REQUIRED_COLUMN = "9993_acceptance_adds_required_column.sql";
const ADDS_DEFAULTED_COLUMN = "9994_acceptance_adds_defaulted_column.sql";

const ADDED_MIGRATIONS: Readonly<Record<string, string>> = {
  [DROPS_FUNCTION]: 'DROP FUNCTION "team_list"(varchar, text, boolean);\n',
  [RENAMES_COLUMN]: 'ALTER TABLE "teams" RENAME COLUMN "name" TO "title";\n',
  [ADDS_REQUIRED_COLUMN]:
    'ALTER TABLE "member_skills" ADD COLUMN "note" text NOT NULL;\n',
  [ADDS_DEFAULTED_COLUMN]:
    'ALTER TABLE "member_skills" ADD COLUMN "note" text DEFAULT \'\' NOT NULL;\n',
};

const once = <Value>(compute: () => Value) => {
  let computed: { readonly value: Value } | undefined;
  return () => {
    computed ??= { value: compute() };
    return computed.value;
  };
};

const drizzleTestsWithAddedMigrations = once(() => {
  const copy = temporaryDir("drizzle");
  cpSync(path.join(REPO_ROOT, "drizzle"), path.join(copy, "drizzle"), {
    recursive: true,
  });
  symlinkSync(
    path.join(REPO_ROOT, "node_modules"),
    path.join(copy, "node_modules"),
  );
  for (const [file, statement] of Object.entries(ADDED_MIGRATIONS)) {
    writeFileSync(path.join(copy, "drizzle", file), statement);
  }
  return run(copy, "bunx", "vitest", "run");
});

describe("#713 11-3 動いている Worker を壊す migration", () => {
  it.each([
    ["AC-004", "関数を DROP する文", DROPS_FUNCTION],
    ["AC-005", "RENAME の文", RENAMES_COLUMN],
    ["AC-006", "既定値の無い NOT NULL の列を足す文", ADDS_REQUIRED_COLUMN],
  ])(
    "%s drizzle/ に%sを持つ migration の file を足すと、drizzle/ の試験がその file の名前を挙げて落ちる",
    (_ac, _statement, file) => {
      const result = drizzleTestsWithAddedMigrations();

      expect({
        failed: result.status !== 0,
        namesMigration: result.output.includes(file),
      }).toEqual({ failed: true, namesMigration: true });
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "AC-007 既定値のある NOT NULL の列を足す文だけを持つ migration の file は、drizzle/ の試験の失敗に挙がらない",
    () => {
      const result = drizzleTestsWithAddedMigrations();

      expect(result.output.includes(ADDS_DEFAULTED_COLUMN)).toBe(false);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "AC-008 上の文で drizzle/ の試験が落ちた時、失敗の文言が、動いている Worker と、表に理由を載せることを言う",
    () => {
      const result = drizzleTestsWithAddedMigrations();

      expect({
        failed: result.status !== 0,
        namesWorker: result.output.includes("Worker"),
        namesReason: result.output.includes("理由"),
      }).toEqual({ failed: true, namesWorker: true, namesReason: true });
    },
    SLOW_TEST_TIMEOUT,
  );
});

const TEAM_PAGE = "web/src/dashboard/pages/Team.ts";

describe("#713 11-4 チームの page", () => {
  it("AC-009 web/src/dashboard/pages/Team.ts で、星取表の表 (h.table) と自分のレベルの記入欄 (checkboxView) を書かない", () => {
    expect(gitGrepLines("h\\.table\\(|checkboxView\\(", TEAM_PAGE)).toEqual([]);
  });

  it(
    "AC-010 チームの画面で、星取表を見る・自分のレベルを記入して保存する・チームの管理の操作をする時の描画と送る要求は、変更の前と同じである",
    () => {
      const result = run(
        REPO_ROOT,
        "bunx",
        "vitest",
        "run",
        "--project",
        "web",
        "web/src/__tests__/acceptance/684-team-page.test.ts",
        "web/src/__tests__/acceptance/685-team-management.test.ts",
      );

      expect(result.status).toBe(0);
    },
    SLOW_TEST_TIMEOUT,
  );
});
