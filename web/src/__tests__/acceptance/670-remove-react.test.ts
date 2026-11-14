import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");

const REACT_PACKAGES = [
  "react",
  "react-dom",
  "@types/react",
  "@types/react-dom",
  "@vitejs/plugin-react",
  "@effect/atom-react",
  "@tanstack/react-router",
  "@radix-ui/react-slot",
  "lucide-react",
];
const REACT_PACKAGE_NAMES = `(${REACT_PACKAGES.join("|")})`;

const CODE_AND_SETTINGS = [
  "web",
  "src",
  "db",
  "lint",
  "scripts",
  "testing",
  "infra",
  "e2e",
  "biome-plugins",
  ":(top,glob)*",
];

const readRepoFile = (file: string) =>
  readFileSync(path.join(REPO_ROOT, file), "utf8");

const gitLines = (args: readonly string[]) => {
  const result = spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  }
  return result.stdout.split("\n").filter((line) => line !== "");
};

const gitGrepLines = (pattern: string, ...pathspecs: readonly string[]) =>
  gitLines(["grep", "--untracked", "-n", "-E", pattern, "--", ...pathspecs]);

const filesIn = (...pathspecs: readonly string[]) =>
  gitLines(["ls-files", "-co", "--exclude-standard", "--", ...pathspecs]);

type Manifest = {
  readonly scripts: Readonly<Record<string, string>>;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
};

const manifest: Manifest = JSON.parse(readRepoFile("package.json"));
const lockfile = readRepoFile("bun.lock");

const resolvedVersionOf = (name: string) => {
  const escaped = name.replaceAll(".", "\\.");
  return lockfile.match(
    new RegExp(`^ {4}"${escaped}": \\["${escaped}@([^"]+)"`, "m"),
  )?.[1];
};

describe("#670 React の依存", () => {
  it("AC-001 package.json の依存に React の時代の 9 つの package が無い", () => {
    const declared = [
      ...Object.keys(manifest.dependencies),
      ...Object.keys(manifest.devDependencies),
    ];

    expect(REACT_PACKAGES.filter((name) => declared.includes(name))).toEqual(
      [],
    );
  });

  it("AC-002 bun.lock に、同じ 9 つの package の entry と依存の宣言が無い", () => {
    expect(
      gitGrepLines(`^[[:space:]]+"${REACT_PACKAGE_NAMES}["/]`, "bun.lock"),
    ).toEqual([]);
  });

  it("AC-015 effect・@effect/platform-bun・@effect/platform-node は、宣言も解決も 4.1.2 のまま", () => {
    const names = ["effect", "@effect/platform-bun", "@effect/platform-node"];

    expect(
      names.map((name) => ({
        name,
        declared: manifest.dependencies[name] ?? manifest.devDependencies[name],
        resolved: resolvedVersionOf(name),
      })),
    ).toEqual(
      names.map((name) => ({ name, declared: "4.1.2", resolved: "4.1.2" })),
    );
  });
});

describe("#670 React の code", () => {
  it("AC-003 repo の code と設定で、同じ 9 つの package とその下の path を import しない", () => {
    expect(
      gitGrepLines(
        `(from|import|require\\()[[:space:]]*\\(?["']${REACT_PACKAGE_NAMES}(/[^"']*)?["']`,
        ...CODE_AND_SETTINGS,
      ),
    ).toEqual([]);
  });

  it("AC-004 repo の code に .tsx・.jsx の file が無い", () => {
    expect(
      filesIn(...CODE_AND_SETTINGS).filter((file) => /\.(tsx|jsx)$/.test(file)),
    ).toEqual([]);
  });

  it("AC-005 root と web の tsconfig.json に jsx の設定が無い", () => {
    expect(
      gitGrepLines(`"jsx"[[:space:]]*:`, "tsconfig.json", "web/tsconfig.json"),
    ).toEqual([]);
  });

  it("AC-006 web/src/components/ と web/src/lib/ に file が無い", () => {
    expect(filesIn("web/src/components", "web/src/lib")).toEqual([]);
  });

  it("AC-007 router・Atom の cache の file と、その試験・プライバシーポリシーの React の試験が無い", () => {
    expect(
      filesIn(
        "web/src/router.tsx",
        "web/src/api.ts",
        "web/src/api-internal.ts",
        "web/src/__tests__/api.test.ts",
        "web/src/__tests__/router.test.ts",
        "web/src/__tests__/memory-only-cache.test.ts",
        "web/src/privacy/__tests__/privacy-page.test.ts",
      ),
    ).toEqual([]);
  });

  it("AC-014 web/src に、自分のレベルの entry の形を TeamDetail の levels から Omit で書き写した型が無い", () => {
    expect(gitGrepLines(`Omit<TeamDetail\\["levels"\\]`, "web/src")).toEqual(
      [],
    );
  });
});

describe("#670 React・Atom 向けの設定", () => {
  it("AC-010 biome.json に Atom の import の禁止が無い", () => {
    expect(gitGrepLines("atom-react|effect/reactivity", "biome.json")).toEqual(
      [],
    );
  });

  it("AC-011 .oxlintrc.json と biome.json に api-internal が無い", () => {
    expect(
      gitGrepLines("api-internal", ".oxlintrc.json", "biome.json"),
    ).toEqual([]);
  });

  it("AC-012 .github/dependabot.yml に atom-react が無い", () => {
    expect(gitGrepLines("atom-react", ".github/dependabot.yml")).toEqual([]);
  });

  it("AC-013 package.json の script に --conditions=browser が無い", () => {
    expect(
      Object.entries(manifest.scripts).filter(([, script]) =>
        script.includes("--conditions=browser"),
      ),
    ).toEqual([]);
  });
});

const lintCommandOf = (tool: string) =>
  (manifest.scripts.lint ?? "")
    .split("&&")
    .map((command) => command.trim())
    .find((command) => command.split(" ")[0] === tool);

type BiomeReport = {
  readonly diagnostics: readonly {
    readonly category: string;
    readonly location: { readonly path: unknown };
  }[];
};

type OxlintReport = {
  readonly diagnostics: readonly { readonly filename: string }[];
};

const fixtureDirs: string[] = [];

afterAll(() => {
  for (const fixtureDir of fixtureDirs) {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});

const runInFixture = (
  fixtureDir: string,
  command: string | undefined,
  reporter: string,
) =>
  command === undefined
    ? ""
    : spawnSync("sh", ["-c", `${command} ${reporter}`], {
        cwd: fixtureDir,
        encoding: "utf8",
        maxBuffer: 256 * 1024 * 1024,
        env: {
          ...process.env,
          PATH: `${path.join(REPO_ROOT, "node_modules/.bin")}${path.delimiter}${process.env.PATH}`,
        },
      }).stdout;

const lint = (files: readonly string[], source: string) => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "taimei-lint-670-"));
  fixtureDirs.push(fixtureDir);
  for (const entry of readdirSync(REPO_ROOT)) {
    if (entry !== "web" && entry !== ".git") {
      symlinkSync(path.join(REPO_ROOT, entry), path.join(fixtureDir, entry));
    }
  }
  for (const file of files) {
    mkdirSync(path.dirname(path.join(fixtureDir, file)), { recursive: true });
    writeFileSync(path.join(fixtureDir, file), source);
  }
  const biomeOutput = runInFixture(
    fixtureDir,
    lintCommandOf("biome"),
    "--reporter=json --max-diagnostics=none",
  );
  const oxlintOutput = runInFixture(
    fixtureDir,
    lintCommandOf("oxlint"),
    "--format json",
  );
  const biome: BiomeReport =
    biomeOutput === "" ? { diagnostics: [] } : JSON.parse(biomeOutput);
  const oxlint: OxlintReport =
    oxlintOutput === "" ? { diagnostics: [] } : JSON.parse(oxlintOutput);
  return {
    biomeCategoriesOf: (file: string) =>
      biome.diagnostics
        .filter(({ location }) => location.path === file)
        .map(({ category }) => category),
    oxlintFinds: (file: string) =>
      oxlint.diagnostics.some(({ filename }) => filename === file),
  };
};

const UNFORMATTED_SWITCH_STATEMENT = `export const pick = (value) => {
  switch (value) {
    default:
      return   1;
  }
};
`;

const LINTED_EXTENSION = /\.(ts|tsx|mts|mjs)$/;

const NEW_FILES = [
  "web/new-probe.ts",
  "web/new-probe.mjs",
  "web/src/new-probe.ts",
  "web/src/new-probe.tsx",
  "web/src/new-probe.mts",
  "web/src/dashboard/new-probe.ts",
  "web/src/dashboard/pages/NewProbe.ts",
  "web/src/dashboard/__tests__/new-probe.test.ts",
  "web/src/new-domain/pages/NewProbe.ts",
];

describe("#670 web の lint は oxlint、format は Biome", () => {
  const existingFiles = filesIn("web").filter(
    (file) => LINTED_EXTENSION.test(file) && !file.startsWith("web/dist/"),
  );
  let result: ReturnType<typeof lint>;

  beforeAll(() => {
    result = lint(
      [...new Set([...existingFiles, ...NEW_FILES])],
      UNFORMATTED_SWITCH_STATEMENT,
    );
  }, 180_000);

  it("AC-008 web/ の今ある file と新しい path のどれに lint の違反を書いても、Biome は lint で指摘せず、oxlint が指摘する", () => {
    const files = [...new Set([...existingFiles, ...NEW_FILES])].sort();
    const biomeLints = (file: string) =>
      result
        .biomeCategoriesOf(file)
        .some(
          (category) => category.startsWith("lint/") || category === "plugin",
        );

    expect(existingFiles.length).toBeGreaterThan(0);
    expect({
      biomeLints: files.filter(biomeLints),
      oxlintMisses: files.filter((file) => !result.oxlintFinds(file)),
    }).toEqual({ biomeLints: [], oxlintMisses: [] });
  });

  it("AC-009 web/ の今ある file に整形されていない code を書くと、Biome が format で指摘する", () => {
    expect(
      existingFiles.filter(
        (file) => !result.biomeCategoriesOf(file).includes("format"),
      ),
    ).toEqual([]);
  });
});
