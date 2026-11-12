import { spawnSync } from "node:child_process";
import {
  cpSync,
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
import { Option } from "effect";
import type { CrashContext } from "foldkit/runtime";
import { resolveConfig } from "vite";
import { afterAll, describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");
const WORKFLOWS_DIR = ".github/workflows";
const BOUNDARY_TEST = "infra/__tests__/iac-boundaries.test.ts";
const VITE_CONFIG = path.join(REPO_ROOT, "web/vite.config.ts");
const START_APPLICATION = "web/src/app/start-application.ts";
const CRASH_TEXT = "画面を表示できませんでした。再読み込みしてください";

const readRepoFile = (file: string) =>
  readFileSync(path.join(REPO_ROOT, file), "utf8");

const temporaryDirs: string[] = [];

const temporaryDir = (name: string) => {
  const dir = mkdtempSync(path.join(tmpdir(), `taimei-${name}-`));
  temporaryDirs.push(dir);
  return dir;
};

const writeFiles = (dir: string, files: Readonly<Record<string, string>>) => {
  for (const [file, source] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), source);
  }
};

afterAll(() => {
  for (const dir of temporaryDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const withoutVitestEnv = () =>
  Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("VITEST")),
  );

const GIT_ENV = {
  ...withoutVitestEnv(),
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
};

const git = (cwd: string, ...args: readonly string[]) => {
  const result = spawnSync(
    "git",
    ["-c", "user.name=acceptance", "-c", "user.email=a@example.com", ...args],
    { cwd, encoding: "utf8", env: GIT_ENV },
  );
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  }
};

const indentOf = (line: string) => line.search(/\S/);

const isOutside = (indent: number) => (line: string) =>
  line.trim() !== "" && indentOf(line) <= indent;

const blockAfter = (lines: readonly string[], start: number) => {
  const rest = lines.slice(start + 1);
  const end = rest.findIndex(isOutside(indentOf(lines[start] ?? "")));
  return end === -1 ? rest : rest.slice(0, end);
};

type Checkout = {
  readonly coneMode: boolean;
  readonly patterns: readonly string[] | undefined;
};

const checkoutOf = (step: readonly string[]): Checkout => {
  const sparse = step.findIndex((line) => /^\s*sparse-checkout:/.test(line));
  return {
    coneMode: !step.some((line) =>
      /^\s*sparse-checkout-cone-mode:\s*false\s*$/.test(line),
    ),
    patterns:
      sparse === -1
        ? undefined
        : blockAfter(step, sparse)
            .map((line) => line.trim())
            .filter((line) => line !== ""),
  };
};

const stepStartOf = (lines: readonly string[], uses: number) =>
  lines.findLastIndex(
    (line, index) =>
      index <= uses &&
      /^\s*- /.test(line) &&
      indentOf(line) <= indentOf(lines[uses] ?? ""),
  );

const checkoutsOf = (workflow: string): readonly Checkout[] => {
  const lines = readRepoFile(`${WORKFLOWS_DIR}/${workflow}`).split("\n");
  return lines.flatMap((line, index) => {
    if (!/^\s*(- )?uses:\s*actions\/checkout@/.test(line)) {
      return [];
    }
    const start = stepStartOf(lines, index);
    return [checkoutOf([lines[start] ?? "", ...blockAfter(lines, start)])];
  });
};

const UPSTREAM_FILES = {
  ".github/workflows/lint.yml": "name: Lint\n",
  ".oxlintrc.json": "{}\n",
  "package.json": "{}\n",
  "repos/foldkit/packages/foldkit/src/index.ts": "export {};\n",
  "src/worker.ts": "export {};\n",
  "web/src/main.ts": "export {};\n",
};
const TOP_LEVEL_WITHOUT_REPOS = [
  ".github",
  ".oxlintrc.json",
  "package.json",
  "src",
  "web",
];
const TOP_LEVEL_WITH_REPOS = [
  ".github",
  ".oxlintrc.json",
  "package.json",
  "repos",
  "src",
  "web",
];

let upstreamWithRepos: string | undefined;

const upstream = () => {
  if (upstreamWithRepos === undefined) {
    upstreamWithRepos = temporaryDir("upstream");
    writeFiles(upstreamWithRepos, UPSTREAM_FILES);
    git(upstreamWithRepos, "init", "--quiet", "--initial-branch=main");
    git(upstreamWithRepos, "add", "--all");
    git(upstreamWithRepos, "commit", "--quiet", "--no-verify", "-m", "seed");
  }
  return upstreamWithRepos;
};

const topLevelCheckedOutBy = ({ coneMode, patterns }: Checkout) => {
  const work = temporaryDir("checkout");
  git(work, "clone", "--quiet", "--no-checkout", upstream(), ".");
  if (patterns !== undefined) {
    git(
      work,
      "sparse-checkout",
      "set",
      coneMode ? "--cone" : "--no-cone",
      ...patterns,
    );
  }
  git(work, "checkout", "--quiet", "main");
  return readdirSync(work)
    .filter((entry) => entry !== ".git")
    .sort();
};

const treesCheckedOutBy = (workflows: readonly string[]) =>
  workflows.flatMap((workflow) =>
    checkoutsOf(workflow).map((checkout) => ({
      workflow,
      topLevel: topLevelCheckedOutBy(checkout),
    })),
  );

const withoutSparseCheckout = (workflowSource: string) => {
  const lines = workflowSource.split("\n");
  const dropped = new Set(
    lines.flatMap((line, index) =>
      /^\s*sparse-checkout(-cone-mode)?:/.test(line)
        ? [
            index,
            ...blockAfter(lines, index).map((_, more) => index + 1 + more),
          ]
        : [],
    ),
  );
  return lines.filter((_, index) => !dropped.has(index)).join("\n");
};

const boundaryTestExitCode = (
  rewriteWorkflow: (workflowSource: string) => string,
) => {
  const fixtureDir = temporaryDir("iac-boundaries");
  cpSync(
    path.join(REPO_ROOT, BOUNDARY_TEST),
    path.join(fixtureDir, BOUNDARY_TEST),
  );
  writeFiles(
    fixtureDir,
    Object.fromEntries(
      readdirSync(path.join(REPO_ROOT, WORKFLOWS_DIR)).map((workflow) => [
        `${WORKFLOWS_DIR}/${workflow}`,
        rewriteWorkflow(readRepoFile(`${WORKFLOWS_DIR}/${workflow}`)),
      ]),
    ),
  );
  symlinkSync(
    path.join(REPO_ROOT, "node_modules"),
    path.join(fixtureDir, "node_modules"),
  );
  git(fixtureDir, "init", "--quiet");
  return spawnSync(
    process.execPath,
    [
      path.join(REPO_ROOT, "node_modules/vitest/vitest.mjs"),
      "run",
      "--root",
      ".",
      BOUNDARY_TEST,
    ],
    { cwd: fixtureDir, encoding: "utf8", env: GIT_ENV },
  ).status;
};

const ignoresReposAtRoot = (dockerignore: string) => {
  const lastRule = dockerignore
    .split("\n")
    .map((line) => line.trim())
    .filter((line) =>
      ["repos", "repos/*", "repos/**"].includes(
        line.replace(/^!/, "").replace(/^\//, "").replace(/\/$/, ""),
      ),
    )
    .at(-1);
  return lastRule !== undefined && !lastRule.startsWith("!");
};

describe("#674 bundle を build する job は repos/ を checkout しない", () => {
  it("AC-001 deploy・drift・lint の job の checkout は、repos/ を持つ repo から repos/ だけを除いた tree を出す", () => {
    expect(
      treesCheckedOutBy(["deploy.yml", "iac-drift.yml", "lint.yml"]),
    ).toEqual(
      ["deploy.yml", "deploy.yml", "iac-drift.yml", "lint.yml"].map(
        (workflow) => ({ workflow, topLevel: TOP_LEVEL_WITHOUT_REPOS }),
      ),
    );
  });

  it("AC-002 workflow の checkout を repos/ を除かない設定に戻すと IaC の境界の試験が落ち、戻さなければ通る", () => {
    expect({
      asWritten: boundaryTestExitCode((workflowSource) => workflowSource),
      withoutSparseCheckout: boundaryTestExitCode(withoutSparseCheckout),
    }).toEqual({ asWritten: 0, withoutSparseCheckout: 1 });
  });

  it("AC-003 lint の job は pull request で走り、本番の bundle を build する", () => {
    const lintWorkflow = readRepoFile(`${WORKFLOWS_DIR}/lint.yml`);

    expect({
      runsOnPullRequest: /^\s*pull_request:/m.test(lintWorkflow),
      buildsProductionBundle:
        /^\s*run:.*scripts\/build-bundle\.sh production\s*$/m.test(
          lintWorkflow,
        ),
    }).toEqual({ runsOnPullRequest: true, buildsProductionBundle: true });
  });

  it("AC-004 e2e の image の build context は repos/ を除く", () => {
    expect(ignoresReposAtRoot(readRepoFile(".dockerignore"))).toBe(true);
  });

  it("AC-005 unit test の job の checkout は、repos/ を含む全体を出す", () => {
    expect(treesCheckedOutBy(["unit-test.yml"])).toEqual([
      { workflow: "unit-test.yml", topLevel: TOP_LEVEL_WITH_REPOS },
    ]);
  });
});

type Manifest = {
  readonly scripts: Readonly<Record<string, string>>;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
};

const manifest: Manifest = JSON.parse(readRepoFile("package.json"));
const lockfile = readRepoFile("bun.lock");

const pinnedVersionOf = (name: string) => ({
  name,
  declared: manifest.dependencies[name] ?? manifest.devDependencies[name],
  resolved: lockfile.match(
    new RegExp(
      `^ {4}"${name.replaceAll(".", "\\.")}": \\["${name.replaceAll(".", "\\.")}@([^"]+)"`,
      "m",
    ),
  )?.[1],
});

const PROBE_FILE = "probe.ts";
const PROBE = `import { Context, Effect, Layer, Schema } from "effect";
import { Command, type Update } from "foldkit";
import type { Document, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { startApplication } from "${path.join(REPO_ROOT, START_APPLICATION).replace(/\.ts$/, "")}";

class Reader extends Context.Service<
  Reader,
  { readonly count: Effect.Effect<number> }
>()("Reader") {}

const Model = Schema.Struct({ count: Schema.Finite });
type Model = typeof Model.Type;
const Message = defineMessageUnion({
  ClickedLink: {},
  ChangedUrl: {},
  CompletedRead: { count: Schema.Finite },
});
type Message = typeof Message.Type;

const Read = Command.define("Read", {
  messages: [Message.CompletedRead],
  execute: Effect.gen(function* () {
    const reader = yield* Reader;
    return Message.CompletedRead({ count: yield* reader.count });
  }),
});

const init = (): Update.Return<Model, Message, Reader> => ({
  model: { count: 0 },
  commands: [Read()],
});
const update = (model: Model): Update.Return<Model, Message, Reader> => ({
  model,
});
const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: "probe",
  body: h.div([], [String(model.count)]),
});
const config = {
  Model,
  init,
  update,
  view,
  container: null,
  routing: {
    onUrlRequest: () => Message.ClickedLink(),
    onUrlChange: () => Message.ChangedUrl(),
  },
};
const resources = Layer.succeed(Reader, { count: Effect.succeed(1) });

export const started = [
  () => startApplication({ ...config, resources }),
  () => startApplication(config),
  () => startApplication({ ...config, resources, devTools: {} }),
];
`;

const probeLineOf = (code: string) =>
  PROBE.split("\n").findIndex((line) => line.includes(code)) + 1;

const WITH_RESOURCES = probeLineOf(
  "startApplication({ ...config, resources })",
);
const WITHOUT_RESOURCES = probeLineOf("startApplication(config)");
const WITH_DEV_TOOLS = probeLineOf("devTools: {}");

let probeTypeErrorLines: readonly number[] | undefined;

const typeErrorLinesOfProbe = () => {
  if (probeTypeErrorLines === undefined) {
    const fixtureDir = temporaryDir("start-application-types");
    writeFiles(fixtureDir, {
      [PROBE_FILE]: PROBE,
      "tsconfig.json": JSON.stringify({
        extends: path.join(REPO_ROOT, "web/tsconfig.json"),
        compilerOptions: { incremental: false, types: [] },
        include: [PROBE_FILE],
        exclude: [],
      }),
    });
    symlinkSync(
      path.join(REPO_ROOT, "node_modules"),
      path.join(fixtureDir, "node_modules"),
    );
    const tsc = spawnSync(
      path.join(REPO_ROOT, "node_modules/.bin/effect-tsgo"),
      ["get-exe-path"],
      { encoding: "utf8" },
    ).stdout.trim();
    const { stdout } = spawnSync(tsc, ["--noEmit", "-p", "tsconfig.json"], {
      cwd: fixtureDir,
      encoding: "utf8",
    });
    probeTypeErrorLines = [
      ...stdout.matchAll(/probe\.ts\((\d+),\d+\): error TS\d+/g),
    ].map(([, line]) => Number(line));
  }
  return probeTypeErrorLines;
};

type OxlintReport = {
  readonly diagnostics: readonly {
    readonly filename: string;
    readonly labels: readonly { readonly span: { readonly line: number } }[];
  }[];
};

const DIRECT_START = `import { Runtime } from "foldkit";

export const run = Runtime.run;
export const makeApplication = Runtime.makeApplication;
`;
const ENTRY = "web/src/app/public/entry.ts";

const oxlintLinesOf = (files: readonly string[]) => {
  const fixtureDir = temporaryDir("direct-start");
  for (const entry of readdirSync(REPO_ROOT)) {
    if (entry !== "web" && entry !== ".git") {
      symlinkSync(path.join(REPO_ROOT, entry), path.join(fixtureDir, entry));
    }
  }
  writeFiles(
    fixtureDir,
    Object.fromEntries(files.map((file) => [file, DIRECT_START])),
  );
  const oxlint = (manifest.scripts.lint ?? "")
    .split("&&")
    .map((command) => command.trim())
    .find((command) => command.split(" ")[0] === "oxlint");
  const output =
    oxlint === undefined
      ? ""
      : spawnSync("sh", ["-c", `${oxlint} --format json`], {
          cwd: fixtureDir,
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${path.join(REPO_ROOT, "node_modules/.bin")}${path.delimiter}${process.env.PATH}`,
          },
        }).stdout;
  const report: OxlintReport =
    output === "" ? { diagnostics: [] } : JSON.parse(output);
  return Object.fromEntries(
    files.map((file) => [
      file,
      [
        ...new Set(
          report.diagnostics
            .filter(({ filename }) => filename === file)
            .flatMap(({ labels }) => labels.map(({ span }) => span.line)),
        ),
      ].sort((left, right) => left - right),
    ]),
  );
};

type Crashed = CrashContext<null, never>;

const crashed: Crashed = {
  error: new Error("acceptance"),
  model: null,
  message: Option.none(),
};

describe("#675 Foldkit の依存と起動の土台、回復できない失敗の画面", () => {
  it("AC-007 foldkit は 0.170.0、@foldkit/vite-plugin は 0.29.0、@effect/platform-browser は 4.1.2 に固定されている", () => {
    expect(
      ["foldkit", "@foldkit/vite-plugin", "@effect/platform-browser"].map(
        pinnedVersionOf,
      ),
    ).toEqual([
      { name: "foldkit", declared: "0.170.0", resolved: "0.170.0" },
      { name: "@foldkit/vite-plugin", declared: "0.29.0", resolved: "0.29.0" },
      {
        name: "@effect/platform-browser",
        declared: "4.1.2",
        resolved: "4.1.2",
      },
    ]);
  });

  it("AC-008 SPA の build の設定に Foldkit の vite plugin が入っている", async () => {
    const config = await resolveConfig(
      { configFile: VITE_CONFIG, logLevel: "silent" },
      "build",
    );

    expect(
      config.plugins.filter(({ name }) => name.startsWith("foldkit")),
    ).not.toEqual([]);
  });

  it("AC-009 resources を渡さずに application を起動する code は型エラーになり、渡す code はならない", () => {
    expect(
      typeErrorLinesOfProbe().filter(
        (line) => line === WITH_RESOURCES || line === WITHOUT_RESOURCES,
      ),
    ).toEqual([WITHOUT_RESOURCES]);
  });

  it("AC-010 起動の口に devTools を渡す code は型エラーになる", () => {
    expect(typeErrorLinesOfProbe()).toEqual([
      WITHOUT_RESOURCES,
      WITH_DEV_TOOLS,
    ]);
  });

  it("AC-011 回復できない失敗の画面は「画面を表示できませんでした。再読み込みしてください」を出す", async () => {
    const { crashView } = await import("../../shared/crash-view");
    const {
      expect: expectInScene,
      given,
      scene,
      text,
    } = await import("foldkit/scene");

    scene(
      {
        update: (model: Crashed, _message: never) => ({ model }),
        view: crashView,
      },
      given(crashed),
      expectInScene(text(CRASH_TEXT)).toExist(),
    );
  });

  it("AC-012 回復できない失敗の画面の title は Taimei", async () => {
    const { crashView } = await import("../../shared/crash-view");
    const { inertHtml } = await import("foldkit/html");

    expect(crashView(crashed, inertHtml).title).toBe("Taimei");
  });

  it("AC-014 起動の口の外の Runtime.run と Runtime.makeApplication は、その行が lint で指摘され、起動の口では指摘されない", () => {
    expect(oxlintLinesOf([ENTRY, START_APPLICATION])).toEqual({
      [ENTRY]: [3, 4],
      [START_APPLICATION]: [],
    });
  });
});
