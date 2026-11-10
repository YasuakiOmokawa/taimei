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

type Manifest = {
  readonly scripts: Readonly<Record<string, string>>;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
  readonly overrides: Readonly<Record<string, string>>;
};

const readRepoFile = (file: string) =>
  readFileSync(path.join(REPO_ROOT, file), "utf8");

const manifest: Manifest = JSON.parse(readRepoFile("package.json"));
const lockfile = readRepoFile("bun.lock");

const declaredVersionOf = (name: string) =>
  manifest.dependencies[name] ?? manifest.devDependencies[name];

const resolvedVersionOf = (name: string) => {
  const escaped = name.replaceAll(".", "\\.");
  return lockfile.match(
    new RegExp(`^ {4}"${escaped}": \\["${escaped}@([^"]+)"`, "m"),
  )?.[1];
};

const pinnedVersionsOf = (names: readonly string[]) =>
  names.map((name) => ({
    name,
    declared: declaredVersionOf(name),
    resolved: resolvedVersionOf(name),
  }));

const pinnedAt = (names: readonly string[], version: string) =>
  names.map((name) => ({ name, declared: version, resolved: version }));

const lintCommands = (manifest.scripts.lint ?? "")
  .split("&&")
  .map((command) => command.trim());

const lintCommandOf = (tool: string) =>
  lintCommands.find((command) => command.split(" ")[0] === tool);

type BiomeReport = {
  readonly diagnostics: readonly {
    readonly category: string;
    readonly location: { readonly path: unknown };
  }[];
};

type OxlintReport = {
  readonly diagnostics: readonly {
    readonly code: string;
    readonly filename: string;
    readonly labels: readonly { readonly span: { readonly line: number } }[];
  }[];
};

type Fixture = Readonly<Record<string, string>>;

type LintResult = {
  readonly biomeCategoriesOf: (file: string) => readonly string[];
  readonly oxlintLinesOf: (file: string) => readonly number[];
  readonly oxlintCodesOf: (file: string) => readonly string[];
};

const fixtureDirs: string[] = [];

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
        env: {
          ...process.env,
          PATH: `${path.join(REPO_ROOT, "node_modules/.bin")}${path.delimiter}${process.env.PATH}`,
        },
      }).stdout;

const uniqueSorted = (values: readonly string[]) => [...new Set(values)].sort();

const lint = (fixture: Fixture): LintResult => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "taimei-lint-"));
  fixtureDirs.push(fixtureDir);
  for (const entry of readdirSync(REPO_ROOT)) {
    if (entry !== "web" && entry !== ".git") {
      symlinkSync(path.join(REPO_ROOT, entry), path.join(fixtureDir, entry));
    }
  }
  for (const [file, source] of Object.entries(fixture)) {
    mkdirSync(path.dirname(path.join(fixtureDir, file)), { recursive: true });
    writeFileSync(path.join(fixtureDir, file), source);
  }
  const biomeOutput = runInFixture(
    fixtureDir,
    lintCommandOf("biome"),
    "--reporter=json",
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
  const oxlintOf = (file: string) =>
    oxlint.diagnostics.filter(({ filename }) => filename === file);
  return {
    biomeCategoriesOf: (file) =>
      uniqueSorted(
        biome.diagnostics
          .filter(({ location }) => location.path === file)
          .map(({ category }) => category),
      ),
    oxlintLinesOf: (file) =>
      [
        ...new Set(
          oxlintOf(file).flatMap(({ labels }) =>
            labels.map(({ span }) => span.line),
          ),
        ),
      ].sort((left, right) => left - right),
    oxlintCodesOf: (file) =>
      uniqueSorted(oxlintOf(file).map(({ code }) => code)),
  };
};

const isLintFinding = (category: string) =>
  category.startsWith("lint/") || category === "plugin";

afterAll(() => {
  for (const fixtureDir of fixtureDirs) {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});

describe("#667 effect と alchemy の版", () => {
  it("AC-001 effect と、effect と同じ版の系列の @effect/* は 4.1.2 に固定されている", () => {
    const names = [
      "effect",
      "@effect/atom-react",
      "@effect/platform-bun",
      "@effect/platform-node",
    ];

    expect(pinnedVersionsOf(names)).toEqual(pinnedAt(names, "4.1.2"));
  });

  it("AC-002 alchemy と @alchemy.run/cloudflare は 2.0.0-beta.85 に固定されている", () => {
    const names = ["alchemy", "@alchemy.run/cloudflare"];

    expect(pinnedVersionsOf(names)).toEqual(pinnedAt(names, "2.0.0-beta.85"));
  });

  it("AC-003 minimumReleaseAge の例外は @taimei-code/auth-client だけのまま", () => {
    expect(
      readRepoFile("bunfig.toml")
        .split("\n")
        .filter((line) => line.startsWith("minimumReleaseAgeExcludes")),
    ).toEqual(['minimumReleaseAgeExcludes = ["@taimei-code/auth-client"]']);
  });

  it("AC-004 IaC の定義は、state の置き場として Worker alchemy-state-store-taimei を名指す", () => {
    const infraDir = path.join(REPO_ROOT, "infra");
    const definitions = readdirSync(infraDir)
      .filter((file) => file.endsWith(".ts"))
      .map((file) => readFileSync(path.join(infraDir, file), "utf8"));

    expect(
      definitions.filter((source) =>
        source.includes('"alchemy-state-store-taimei"'),
      ),
    ).toHaveLength(1);
  });
});

describe("#672 vite の版", () => {
  it("AC-010 vite は 8 系に固定され、override は vite を固定しない", () => {
    expect({
      declared: declaredVersionOf("vite")?.replace(/^[~^]/, "").split(".")[0],
      resolved: resolvedVersionOf("vite")?.split(".")[0],
      override: manifest.overrides.vite,
    }).toEqual({ declared: "8", resolved: "8", override: undefined });
  });
});

const FORM_ELEMENTS_VIEW = `import { html } from "foldkit/html";

const h = html<never>();

export const view = () =>
  h.form(
    [],
    [
      h.button([], ["送信"]),
      h.input([h.Name("name")]),
      h.textarea([h.Name("note")], ["メモ"]),
      h.select([h.Name("level")], [h.option([], ["1"])]),
    ],
  );
`;

const FORM_ELEMENTS_AND_STORAGE_VIEW = `${FORM_ELEMENTS_VIEW}
export const remembered = () => localStorage.getItem("probe");
`;

const SVG_VIEW = `import { html } from "foldkit/html";

const h = html<never>();

export const view = () =>
  h.span(
    [],
    [
      h.svg([h.Attribute("viewBox", "0 0 24 24")], [h.title([], ["印"])]),
    ],
  );
`;

const STORAGE_WRITES = `export const remember = (value: string) => {
  localStorage.setItem("teams", value);
  sessionStorage.setItem("teams", value);
  document.cookie = \`teams=\${value}\`;
  return indexedDB.open("teams");
};

export const cached = () => caches.open("teams");
`;

const PERSISTENCE_IMPORTS = `import { KeyValueStore } from "effect/persistence";
import { layerMemory } from "effect/persistence/KeyValueStore";

export const stores = [KeyValueStore, layerMemory];
`;

const REPOS_IMPORT = `import { Runtime } from "../../../../repos/foldkit/packages/foldkit/src/index";

export const runtime = Runtime;
`;

const EFFECT_RUN_IN_UPDATE = `import { Effect } from "effect";

export const update = (model: number) => {
  void Effect.runPromise(Effect.log(model));
  return model;
};
`;

const MODULE_LEVEL_STATE = `import { html } from "foldkit/html";

const h = html<never>();

let renderCount = 0;

export const view = () => {
  renderCount += 1;
  return h.p([], [String(renderCount)]);
};
`;

const ATOM_IMPORT = `import { useAtomValue } from "@effect/atom-react";

export const read = useAtomValue;
`;

const UNFORMATTED = "export const   spaced=1\n";

const FORM_IN_PAGE = "web/src/dashboard/pages/FormProbe.ts";
const FORM_IN_SHARED_UI = "web/src/shared/ui/form-probe-view.ts";
const SVG_IN_PAGE = "web/src/dashboard/pages/SvgProbe.ts";
const STORAGE_IN_NEW_FILE = "web/src/dashboard/storage-probe.ts";
const PERSISTENCE_IN_NEW_FILE = "web/src/dashboard/persistence-probe.ts";
const REPOS_IN_PAGE = "web/src/dashboard/pages/ReposProbe.ts";
const EFFECT_RUN_IN_PAGE = "web/src/dashboard/pages/EffectRunProbe.ts";
const STATE_IN_PAGE = "web/src/dashboard/pages/StateProbe.ts";
const REACT_FILE = "web/src/dashboard/teams-page.tsx";
const UNFORMATTED_NEW_FILE = "web/src/dashboard/pages/UnformattedProbe.ts";

describe("#673 新しい web の file の違反を、bun run lint が流す oxlint が指摘する", () => {
  let result: LintResult;

  beforeAll(() => {
    result = lint({
      [FORM_IN_PAGE]: FORM_ELEMENTS_VIEW,
      [FORM_IN_SHARED_UI]: FORM_ELEMENTS_AND_STORAGE_VIEW,
      [SVG_IN_PAGE]: SVG_VIEW,
      [STORAGE_IN_NEW_FILE]: STORAGE_WRITES,
      [PERSISTENCE_IN_NEW_FILE]: PERSISTENCE_IMPORTS,
      [REPOS_IN_PAGE]: REPOS_IMPORT,
      [EFFECT_RUN_IN_PAGE]: EFFECT_RUN_IN_UPDATE,
      [STATE_IN_PAGE]: MODULE_LEVEL_STATE,
      [REACT_FILE]: ATOM_IMPORT,
      [UNFORMATTED_NEW_FILE]: UNFORMATTED,
    });
  });

  it("AC-012 web/src/shared/ui/ の外の h.button・h.input・h.textarea・h.select は、その行が指摘される", () => {
    expect(result.oxlintLinesOf(FORM_IN_PAGE)).toEqual([9, 10, 11, 12]);
  });

  it("AC-013 同じ form の要素を web/src/shared/ui/ の下に書くと、その行は指摘されない (同じ file の storage の行だけが指摘される)", () => {
    expect(result.oxlintLinesOf(FORM_IN_SHARED_UI)).toEqual([16]);
  });

  it("AC-014 h.svg は、その行が指摘される", () => {
    expect(result.oxlintLinesOf(SVG_IN_PAGE)).toEqual([9]);
  });

  it("AC-015 localStorage・sessionStorage・document.cookie・indexedDB・caches に触れる行が指摘される", () => {
    expect(result.oxlintLinesOf(STORAGE_IN_NEW_FILE)).toEqual([2, 3, 4, 5, 8]);
  });

  it("AC-016 effect/persistence と、その下の import の行が指摘される", () => {
    expect(result.oxlintLinesOf(PERSISTENCE_IN_NEW_FILE)).toEqual([1, 2]);
  });

  it("AC-017 repos/ の下の import の行が指摘される", () => {
    expect(result.oxlintLinesOf(REPOS_IN_PAGE)).toEqual([1]);
  });

  it("AC-018 update の中の Effect.runPromise の行が指摘される", () => {
    expect(result.oxlintLinesOf(EFFECT_RUN_IN_PAGE)).toEqual([4]);
  });

  it("AC-019 foldkit を import する file の module の直下の let は、Foldkit の plugin の rule で指摘される", () => {
    expect({
      lines: result.oxlintLinesOf(STATE_IN_PAGE),
      fromFoldkitPlugin: result
        .oxlintCodesOf(STATE_IN_PAGE)
        .some((code) => code.startsWith("foldkit(")),
    }).toEqual({ lines: [5], fromFoldkitPlugin: true });
  });

  it("AC-020 今の React の file の path に書いた Atom の import は、Biome が noRestrictedImports で指摘し、oxlint は指摘しない", () => {
    expect({
      biome: result
        .biomeCategoriesOf(REACT_FILE)
        .includes("lint/style/noRestrictedImports"),
      oxlint: result.oxlintLinesOf(REACT_FILE),
    }).toEqual({ biome: true, oxlint: [] });
  });

  it("AC-022 新しい file の整形されていない code は、Biome が format で指摘する", () => {
    expect(result.biomeCategoriesOf(UNFORMATTED_NEW_FILE)).toContain("format");
  });
});

const SWITCH_STATEMENT = `export const pick = (value) => {
  switch (value) {
    default:
      return 1;
  }
};
`;

const LINTED_EXTENSION = /\.(ts|tsx|mts|mjs)$/;

const existingWebFiles = () =>
  readdirSync(path.join(REPO_ROOT, "web"), {
    recursive: true,
    encoding: "utf8",
  })
    .filter(
      (file) =>
        LINTED_EXTENSION.test(file) &&
        !file.startsWith("dist") &&
        !file.includes("node_modules"),
    )
    .map((file) => `web/${file.split(path.sep).join("/")}`);

const REACT_FILES = [
  "web/src/main.tsx",
  "web/src/router.tsx",
  "web/src/api.ts",
  "web/src/api-internal.ts",
  "web/src/dashboard/teams-page.tsx",
  "web/src/landing/landing-page.tsx",
];

const NEW_FILES = [
  "web/new-probe.ts",
  "web/src/new-probe.ts",
  "web/src/dashboard/new-probe.ts",
  "web/src/dashboard/pages/NewProbe.ts",
  "web/src/dashboard/pages/__tests__/NewProbe.test.ts",
  "web/src/new-domain/pages/NewProbe.ts",
];

describe("#673 1 つの file に効く linter は 1 つ", () => {
  it("AC-021 web の今ある path と新しい path のどれに同じ違反を書いても、Biome と oxlint のちょうど一方だけが指摘する (今の React の file は Biome、新しい file は oxlint)", () => {
    const files = uniqueSorted([
      ...existingWebFiles(),
      ...REACT_FILES,
      ...NEW_FILES,
    ]);
    const result = lint(
      Object.fromEntries(files.map((file) => [file, SWITCH_STATEMENT])),
    );
    const biomeFinds = (file: string) =>
      result.biomeCategoriesOf(file).some(isLintFinding);
    const oxlintFinds = (file: string) => result.oxlintLinesOf(file).length > 0;

    expect({
      notExactlyOne: files.filter(
        (file) => biomeFinds(file) === oxlintFinds(file),
      ),
      reactFilesBiomeMisses: REACT_FILES.filter((file) => !biomeFinds(file)),
      newFilesOxlintMisses: NEW_FILES.filter((file) => !oxlintFinds(file)),
    }).toEqual({
      notExactlyOne: [],
      reactFilesBiomeMisses: [],
      newFilesOxlintMisses: [],
    });
  });
});

describe("#673 lint の入口", () => {
  it("AC-023 bun run lint は Biome・oxlint・fallow を流す", () => {
    expect(lintCommands.map((command) => command.split(" ")[0])).toEqual(
      expect.arrayContaining(["biome", "oxlint", "fallow"]),
    );
  });

  it("AC-024 CI の lint の job は bun run lint を流す", () => {
    expect(readRepoFile(".github/workflows/lint.yml")).toMatch(
      /^\s+run: bun run lint$/m,
    );
  });

  it("AC-025 @foldkit/oxlint-plugin は 0.15.4 に固定され、oxlint が依存にある", () => {
    expect({
      plugin: pinnedVersionsOf(["@foldkit/oxlint-plugin"]),
      oxlint: typeof declaredVersionOf("oxlint"),
    }).toEqual({
      plugin: pinnedAt(["@foldkit/oxlint-plugin"], "0.15.4"),
      oxlint: "string",
    });
  });
});
