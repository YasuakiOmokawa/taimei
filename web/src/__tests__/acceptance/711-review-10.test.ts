import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  existsSync,
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
const SLOW_TEST_TIMEOUT = 300_000;

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

const readRepoFile = (file: string) =>
  readFileSync(path.join(REPO_ROOT, file), "utf8");

const temporaryDirs: string[] = [];
afterAll(() => {
  for (const dir of temporaryDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const COPIED_DIRS = new Set(["web", "src", "db", "infra"]);
const SKIPPED_IN_COPY = new Set(["node_modules"]);
const SKIPPED_IN_DIR_COPY = new Set(["dist", "tsconfig.tsbuildinfo"]);
const ACCEPTANCE_DIRS = [
  "web/src/__tests__/acceptance",
  "src/__tests__/acceptance",
];

const repoCopy = () => {
  const copy = mkdtempSync(path.join(tmpdir(), "taimei-711-"));
  temporaryDirs.push(copy);
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

const writeInto = (copy: string, file: string, source: string) => {
  mkdirSync(path.dirname(path.join(copy, file)), { recursive: true });
  writeFileSync(path.join(copy, file), source);
};

const replaceIn = (copy: string, file: string, from: string, to: string) => {
  const before = readFileSync(path.join(copy, file), "utf8");
  const after = before.replace(from, to);
  if (after === before) {
    throw new Error(`${file} に ${from} が無い`);
  }
  writeFileSync(path.join(copy, file), after);
};

const typecheckIn = (copy: string) => run(copy, "bun", "run", "typecheck");

const errorLinesOf = (output: string) =>
  output.split("\n").filter((line) => line.includes("error TS"));

describe("#711 10-3 Worker の binding の足し忘れ", () => {
  it(
    "AC-005 src/app.ts の Env に binding を足すと、bun run typecheck が infra/stages.ts の型エラーで落ちる",
    () => {
      const copy = repoCopy();
      replaceIn(
        copy,
        "src/app.ts",
        "readonly SENTRY_DSN?: string;",
        "readonly SENTRY_DSN?: string;\n  readonly ACCEPTANCE_BINDING?: string;",
      );

      const result = typecheckIn(copy);

      expect({
        failed: result.status !== 0,
        declarationErrors:
          errorLinesOf(result.output).filter((line) =>
            line.startsWith("infra/stages.ts"),
          ).length > 0,
      }).toEqual({ failed: true, declarationErrors: true });
    },
    SLOW_TEST_TIMEOUT,
  );
});

const TEST_FILE = /^[^(:]*(__tests__\/|\.test\.ts)/;

describe("#711 10-4 dashboard の route と先読みの検査の対象", () => {
  it(
    "AC-006 dashboard の route の union に variant を足すと、bun run typecheck が、その variant が足りないことを挙げる試験の file の型エラーで落ちる",
    () => {
      const copy = repoCopy();
      replaceIn(
        copy,
        "web/src/app/dashboard/route.ts",
        "Members: {},",
        "Members: {},\n  AcceptanceExtra: {},",
      );

      const result = typecheckIn(copy);

      expect({
        failed: result.status !== 0,
        testFileErrors:
          errorLinesOf(result.output).filter(
            (line) => TEST_FILE.test(line) && line.includes("AcceptanceExtra"),
          ).length > 0,
      }).toEqual({ failed: true, testFileErrors: true });
    },
    SLOW_TEST_TIMEOUT,
  );
});

const BRAND_CAST = "src/acceptance-brand-cast.ts";
const RAW_COMPANY_FILTER = "src/acceptance-company-filter.ts";
const DB_CLIENT_IMPORT = "src/acceptance-db-client.ts";
const PROVIDE_DB_IN_TEST = "src/__tests__/acceptance-provide-db.test.ts";
const COMPANY_FILTER_IN_TEST =
  "src/__tests__/acceptance-company-filter.test.ts";

const RAW_COMPANY_FILTER_SOURCE = [
  'import { eq } from "drizzle-orm";',
  'import { teams } from "@/db/drizzle/schema";',
  "",
  "export const filter = (companyId: string) =>",
  "  eq(teams.companyId, companyId);",
  "",
].join("\n");

let lintFixtures: string | undefined;
const lintCopy = () => {
  if (lintFixtures === undefined) {
    const copy = repoCopy();
    writeInto(
      copy,
      BRAND_CAST,
      'import type { CompanyId } from "@/db/company-id";\n\nexport const id = "c" as CompanyId;\n',
    );
    writeInto(copy, RAW_COMPANY_FILTER, RAW_COMPANY_FILTER_SOURCE);
    writeInto(copy, COMPANY_FILTER_IN_TEST, RAW_COMPANY_FILTER_SOURCE);
    writeInto(
      copy,
      DB_CLIENT_IMPORT,
      'import { db } from "@/db/drizzle/client";\n\nexport const client = db;\n',
    );
    writeInto(
      copy,
      PROVIDE_DB_IN_TEST,
      [
        'import { Effect } from "effect";',
        'import { Db } from "@/src/services/db-service";',
        "",
        'export const provide = (tx: Db["Service"]) =>',
        "  Effect.void.pipe(Effect.provideService(Db, tx));",
        "",
      ].join("\n"),
    );
    lintFixtures = copy;
  }
  return lintFixtures;
};

const lintIn = (copy: string, file: string) =>
  run(copy, "bunx", "biome", "lint", file);

describe("#711 10-5 src と db の規約を lint が止める", () => {
  it.each([
    ["AC-007 id の brand に as を書く", BRAND_CAST, "Schema"],
    [
      "AC-008 試験でない file で eq(<表>.companyId, …) を書く",
      RAW_COMPANY_FILTER,
      "companyFilter",
    ],
    [
      "AC-009 試験でない file で @/db/drizzle/client を import する",
      DB_CLIENT_IMPORT,
      DB_CLIENT_IMPORT,
    ],
    [
      "AC-010 試験の file で Effect.provideService(Db, …) を書く",
      PROVIDE_DB_IN_TEST,
      "taimei_app",
    ],
  ])(
    "%s と、biome lint がその file を挙げて落ち、文言が直し方を言う",
    (_, file, hint) => {
      const result = lintIn(lintCopy(), file);

      expect({
        failed: result.status !== 0,
        namesFile: result.output.includes(file),
        hints: result.output.includes(hint),
      }).toEqual({ failed: true, namesFile: true, hints: true });
    },
    SLOW_TEST_TIMEOUT,
  );

  it.each([["db/scoped.ts"], [COMPANY_FILTER_IN_TEST]])(
    "AC-011 %s の eq(<表>.companyId, …) は biome lint で落ちない",
    (file) => {
      expect(lintIn(lintCopy(), file).status).toBe(0);
    },
    SLOW_TEST_TIMEOUT,
  );
});

const scriptsOf = (): Record<string, string | undefined> =>
  JSON.parse(readRepoFile("package.json")).scripts;

describe("#711 10-6 手順を command が持つ", () => {
  it("AC-012 package.json の script check は typecheck・lint・test:db を流す", () => {
    const check = scriptsOf().check ?? "";

    expect({
      typecheck: check.includes("typecheck"),
      lint: check.includes("lint"),
      testDb: check.includes("test:db"),
    }).toEqual({ typecheck: true, lint: true, testDb: true });
  });

  it("AC-013 package.json は script e2e と qa:cron を持つ", () => {
    const scripts = scriptsOf();

    expect({
      e2e: typeof scripts.e2e,
      qaCron: typeof scripts["qa:cron"],
    }).toEqual({ e2e: "string", qaCron: "string" });
  });

  it("AC-014 scripts/qa-serve.sh を知らない引数で流すと、usage が cron を挙げて 0 以外で終わる", () => {
    const result = run(
      REPO_ROOT,
      "bash",
      "scripts/qa-serve.sh",
      "acceptance-unknown",
    );

    expect({
      failed: result.status !== 0,
      namesCron: result.output.includes("cron"),
    }).toEqual({ failed: true, namesCron: true });
  });
});

describe("#711 10-7 web の typecheck が辿る server の file", () => {
  it("AC-017 web/domain-projects/core.json に src/services/・src/lib/・db/drizzle/・db/scoped の file を書かない", () => {
    expect(
      gitGrepLines(
        "src/services/|src/lib/|db/drizzle/|db/scoped",
        "web/domain-projects/core.json",
      ),
    ).toEqual([]);
  });

  it("AC-018 src/spa-contract.ts で ./services/ を import しない", () => {
    expect(gitGrepLines('from "\\./services/', "src/spa-contract.ts")).toEqual(
      [],
    );
  });
});

const INSTRUCTION_FILES = [
  "CLAUDE.md",
  "db/CLAUDE.md",
  "drizzle/CLAUDE.md",
  "e2e/CLAUDE.md",
  "src/CLAUDE.md",
  "src/services/CLAUDE.md",
  "web/src/CLAUDE.md",
];
const INSTRUCTION_LINES_BEFORE = 57;

const nonBlankLinesOf = (file: string) =>
  existsSync(path.join(REPO_ROOT, file))
    ? readRepoFile(file)
        .split("\n")
        .filter((line) => line.trim() !== "").length
    : 0;

describe("#711 10-8 CLAUDE.md の記述量", () => {
  it("AC-019 repo の CLAUDE.md の空行を除いた行数の合計は 57 より少ない", () => {
    const total = INSTRUCTION_FILES.map(nonBlankLinesOf).reduce(
      (sum, lines) => sum + lines,
      0,
    );

    expect(total).toBeLessThan(INSTRUCTION_LINES_BEFORE);
  });

  it("AC-020 repo の CLAUDE.md に、仕組みと command に移した規則の名前を書かない", () => {
    expect(
      gitGrepLines(
        "bump_company_team_list|companyFilter|asAppRole|NPM_TOKEN|/api/<page>|bun run typecheck",
        ...INSTRUCTION_FILES,
      ),
    ).toEqual([]);
  });

  it("AC-023 docs/runbook/production.md は、手作業の SQL と backup の後の bump_company_team_list と Deploy の扱いを書く", () => {
    const runbook = readRepoFile("docs/runbook/production.md");

    expect({
      bump: runbook.includes("bump_company_team_list"),
      backup: runbook.includes("backup"),
      deploy: runbook.includes("Deploy"),
    }).toEqual({ bump: true, backup: true, deploy: true });
  });
});
