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

const temporaryDirs: string[] = [];
afterAll(() => {
  for (const dir of temporaryDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const COPIED_DIRS = new Set(["web", "src", "db"]);
const SKIPPED_IN_COPY = new Set(["node_modules"]);
const SKIPPED_IN_WEB_COPY = new Set(["dist", "tsconfig.tsbuildinfo"]);
const ACCEPTANCE_DIR = "web/src/__tests__/acceptance";

const repoCopy = () => {
  const copy = mkdtempSync(path.join(tmpdir(), "taimei-688-"));
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
        filter: (file) => !SKIPPED_IN_WEB_COPY.has(path.basename(file)),
      });
    } else if (statSync(source).isFile()) {
      copyFileSync(source, target);
    } else {
      symlinkSync(source, target);
    }
  }
  rmSync(path.join(copy, ACCEPTANCE_DIR), { recursive: true, force: true });
  writeInto(
    copy,
    `${ACCEPTANCE_DIR}/acceptance-placeholder.test.ts`,
    'import { it } from "vitest";\nit("placeholder", () => {});\n',
  );
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

function writeInto(copy: string, file: string, source: string) {
  mkdirSync(path.dirname(path.join(copy, file)), { recursive: true });
  writeFileSync(path.join(copy, file), source);
}

const typecheckIn = (copy: string) => run(copy, "bun", "run", "typecheck");

const webTestsIn = (copy: string) =>
  run(copy, "bunx", "vitest", "run", "--project", "web");

const ts6307LinesOf = (output: string, file: string) =>
  output
    .split("\n")
    .filter((line) => line.startsWith(file) && line.includes("TS6307"));

const linesNaming = (output: string, name: string) =>
  output.split("\n").filter((line) => line.includes(name));

const lazily = <A>(compute: () => A) => {
  let value: { readonly result: A } | undefined;
  return () => {
    value ??= { result: compute() };
    return value.result;
  };
};

const fixture = (file: string, imported: string) => ({
  file,
  source: `import * as imported from "${imported}";\nexport const fixture = imported;\n`,
});

const OWN_PAGE_FIXTURES = [
  fixture(
    "web/src/dashboard/acceptance-fixture-dashboard-to-own-page.ts",
    "./pages/Teams",
  ),
  fixture(
    "web/src/privacy/acceptance-fixture-privacy-to-own-page.ts",
    "./pages/Privacy",
  ),
  fixture(
    "web/src/dashboard/acceptance-fixture-dashboard-to-own-test.ts",
    "./__tests__/level.test",
  ),
];

const OTHER_PAGE_FIXTURES = [
  fixture(
    "web/src/privacy/pages/AcceptanceFixturePrivacyToLandingPage.ts",
    "../../landing/pages/Landing",
  ),
  fixture(
    "web/src/dashboard/pages/AcceptanceFixtureDashboardToPrivacyPage.ts",
    "../../privacy/pages/Privacy",
  ),
];

const OTHER_DOMAIN_FROM_PAGE_FIXTURES = [
  fixture(
    "web/src/landing/pages/AcceptanceFixtureLandingToPrivacy.ts",
    "../../privacy/facts",
  ),
  fixture(
    "web/src/privacy/pages/AcceptanceFixturePrivacyToDashboard.ts",
    "../../dashboard/level",
  ),
];

const TO_APP_FIXTURES = [
  fixture(
    "web/src/dashboard/acceptance-fixture-dashboard-to-app.ts",
    "../app/document-navigation",
  ),
  fixture(
    "web/src/dashboard/pages/AcceptanceFixtureDashboardPageToApp.ts",
    "../../app/dashboard/route",
  ),
  fixture(
    "web/src/shared/acceptance-fixture-shared-to-app.ts",
    "../app/document-navigation",
  ),
];

const SHARED_TO_PAGE_FIXTURES = [
  fixture(
    "web/src/shared/acceptance-fixture-shared-to-landing-page.ts",
    "../landing/pages/Landing",
  ),
];

const TEST_FIXTURES = [
  fixture(
    "web/src/landing/__tests__/acceptance-fixture-landing-test-to-privacy.ts",
    "../../privacy/facts",
  ),
  fixture(
    "web/src/dashboard/__tests__/acceptance-fixture-dashboard-test-to-landing-page.ts",
    "../../landing/pages/Landing",
  ),
  fixture(
    "web/src/shared/__tests__/acceptance-fixture-shared-test-to-dashboard.ts",
    "../../dashboard/level",
  ),
  fixture(
    "web/src/shared/ui/__tests__/acceptance-fixture-shared-ui-test-to-dashboard.ts",
    "../../../dashboard/level",
  ),
];

const ALLOWED_FIXTURES = [
  fixture(
    "web/src/app/acceptance-fixture-app-to-landing-page.ts",
    "../landing/pages/Landing",
  ),
  fixture(
    "web/src/app/acceptance-fixture-app-to-privacy-page.ts",
    "../privacy/pages/Privacy",
  ),
  fixture(
    "web/src/app/acceptance-fixture-app-to-dashboard-page.ts",
    "../dashboard/pages/Teams",
  ),
  {
    file: "web/src/dashboard/pages/AcceptanceFixtureDashboardPageAllowed.ts",
    source:
      'import { SESSION_HEADER } from "../../../../src/spa-contract";\nimport * as level from "../level";\nimport * as submission from "../../shared/submission";\nexport const fixture = { SESSION_HEADER, level, submission };\n',
  },
  fixture(
    "web/src/privacy/__tests__/acceptance-fixture-privacy-test-to-own-page.ts",
    "../pages/Privacy",
  ),
];

const typecheckWithViolations = lazily(() => {
  const copy = repoCopy();
  for (const { file, source } of [
    ...OWN_PAGE_FIXTURES,
    ...OTHER_PAGE_FIXTURES,
    ...OTHER_DOMAIN_FROM_PAGE_FIXTURES,
    ...TO_APP_FIXTURES,
    ...SHARED_TO_PAGE_FIXTURES,
    ...TEST_FIXTURES,
  ]) {
    writeInto(copy, file, source);
  }
  return typecheckIn(copy);
});

const expectTs6307For = (file: string) => {
  const result = typecheckWithViolations();

  expect(result.status).not.toBe(0);
  expect(ts6307LinesOf(result.output, file)).not.toEqual([]);
};

describe("#688 page と app の境界の型", () => {
  it.each(OWN_PAGE_FIXTURES)(
    "AC-001 domain の page と試験でない file が同じ domain の page と試験を import すると、bun run typecheck がその file の TS6307 を出す ($file)",
    ({ file }) => expectTs6307For(file),
    SLOW_TEST_TIMEOUT,
  );

  it.each(OTHER_PAGE_FIXTURES)(
    "AC-002 domain の page が別の domain の page を import すると、bun run typecheck がその file の TS6307 を出す ($file)",
    ({ file }) => expectTs6307For(file),
    SLOW_TEST_TIMEOUT,
  );

  it.each(OTHER_DOMAIN_FROM_PAGE_FIXTURES)(
    "AC-003 domain の page が別の domain の page でない file を import すると、bun run typecheck がその file の TS6307 を出す ($file)",
    ({ file }) => expectTs6307For(file),
    SLOW_TEST_TIMEOUT,
  );

  it.each(TO_APP_FIXTURES)(
    "AC-004 domain と shared の file が app の file を import すると、bun run typecheck がその file の TS6307 を出す ($file)",
    ({ file }) => expectTs6307For(file),
    SLOW_TEST_TIMEOUT,
  );

  it.each(SHARED_TO_PAGE_FIXTURES)(
    "AC-005 shared の file が domain の page を import すると、bun run typecheck がその file の TS6307 を出す ($file)",
    ({ file }) => expectTs6307For(file),
    SLOW_TEST_TIMEOUT,
  );

  it.each(TEST_FIXTURES)(
    "AC-006 domain の試験が別の domain を、shared の試験が domain を import すると、bun run typecheck がその file の TS6307 を出す ($file)",
    ({ file }) => expectTs6307For(file),
    SLOW_TEST_TIMEOUT,
  );

  it(
    "AC-007 app から各 domain の page を、page から同じ domain と shared と契約を、domain の試験から同じ domain の page を import する file を足しても、bun run typecheck は通る",
    () => {
      const copy = repoCopy();
      for (const { file, source } of ALLOWED_FIXTURES) {
        writeInto(copy, file, source);
      }

      const result = typecheckIn(copy);

      expect(result.output).not.toContain("error TS");
      expect(result.status).toBe(0);
    },
    SLOW_TEST_TIMEOUT,
  );
});

const TECHNICAL_DIRS = [
  "web/src/dashboard/lib",
  "web/src/shared/components",
  "web/src/app/dashboard/lib",
];
const BARRELS = ["web/src/dashboard/index.ts", "web/src/shared/ui/index.ts"];
const MISPLACED_PAGES = [
  "web/src/pages",
  "web/src/app/pages",
  "web/src/shared/pages",
  "web/src/dashboard/acceptancefixture/pages",
];
const UNREGISTERED_DIR = "acceptancefixtureunregistered";

const webTestsWithViolations = lazily(() => {
  const copy = repoCopy();
  mkdirSync(path.join(copy, "web/src/dashboard/lib"));
  writeInto(copy, "web/src/shared/components/acceptance-fixture.ts", "");
  writeInto(copy, "web/src/app/dashboard/lib/acceptance-fixture.ts", "");
  for (const barrel of BARRELS) {
    writeInto(copy, barrel, "export {};\n");
  }
  for (const pages of MISPLACED_PAGES) {
    writeInto(copy, `${pages}/AcceptanceFixture.ts`, "export {};\n");
  }
  writeInto(
    copy,
    `web/src/${UNREGISTERED_DIR}/acceptance-fixture.ts`,
    "export {};\n",
  );
  return webTestsIn(copy);
});

const expectWebTestsNaming = (name: string) => {
  const result = webTestsWithViolations();

  expect(result.status).not.toBe(0);
  expect(linesNaming(result.output, name)).not.toEqual([]);
};

describe("#688 web/src の構造の検査", () => {
  it.each(TECHNICAL_DIRS)(
    "AC-008 lib か components の dir を置くと、web の試験がその path を含む行を出して落ちる (%s)",
    (dir) => expectWebTestsNaming(dir),
    SLOW_TEST_TIMEOUT,
  );

  it.each(BARRELS)(
    "AC-009 index.ts を置くと、web の試験がその path を含む行を出して落ちる (%s)",
    (barrel) => expectWebTestsNaming(barrel),
    SLOW_TEST_TIMEOUT,
  );

  it.each(MISPLACED_PAGES)(
    "AC-010 pages の dir を <domain>/pages の外に置くと、web の試験がその path を含む行を出して落ちる (%s)",
    (pages) => {
      const result = webTestsWithViolations();

      expect(result.status).not.toBe(0);
      expect(
        linesNaming(result.output, pages).filter(
          (line) => !line.includes(`${pages}/AcceptanceFixture.ts`),
        ),
      ).not.toEqual([]);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "AC-011 web/domain-projects に定義の無い名前の dir を web/src の直下に置くと、web の試験がその名前を含む行を出して落ちる",
    () => expectWebTestsNaming(UNREGISTERED_DIR),
    SLOW_TEST_TIMEOUT,
  );

  it(
    "AC-012 今の tree (受け入れテストの置き場に試験の file がある) で、web の試験と bun run typecheck は通る",
    () => {
      const copy = repoCopy();

      const webTests = webTestsIn(copy);
      const typecheck = typecheckIn(copy);

      expect(webTests.output).not.toContain("FAIL");
      expect(webTests.status).toBe(0);
      expect(typecheck.output).not.toContain("error TS");
      expect(typecheck.status).toBe(0);
    },
    SLOW_TEST_TIMEOUT,
  );
});

const LINT_FIXTURE = "web/src/dashboard/pages/AcceptanceFixtureMutation.ts";
const LINT_FIXTURE_SOURCE = `import * as Mutation from "../mutation";
export const started = Mutation.RenameTeam({ teamId: "t", name: "n" });
export const submitted = Mutation.submitRenameTeam(Mutation.init(), { teamId: "t", name: "n" });
`;

type OxlintReport = {
  readonly diagnostics: readonly {
    readonly code: string;
    readonly filename: string;
    readonly labels: readonly { readonly span: { readonly line: number } }[];
  }[];
};

describe("#688 page が更新を始める口の lint", () => {
  it(
    "AC-013 page が dashboard/mutation の namespace から更新の Command を作る行を oxlint が指摘し、submit で始まる関数の呼び出しは指摘しない",
    () => {
      const copy = repoCopy();
      writeInto(copy, LINT_FIXTURE, LINT_FIXTURE_SOURCE);

      const result = spawnSync(
        path.join(copy, "node_modules/.bin/oxlint"),
        ["--disable-nested-config", "--format", "json", LINT_FIXTURE],
        { cwd: copy, encoding: "utf8" },
      );
      const report: OxlintReport = JSON.parse(result.stdout);

      expect(
        report.diagnostics
          .filter(
            ({ filename, code }) =>
              filename === LINT_FIXTURE &&
              code === "taimei(mutation-start-only-through-submit)",
          )
          .flatMap(({ labels }) => labels.map(({ span }) => span.line)),
      ).toEqual([2]);
    },
    SLOW_TEST_TIMEOUT,
  );
});
