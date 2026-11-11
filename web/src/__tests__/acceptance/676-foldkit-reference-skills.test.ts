import { spawnSync } from "node:child_process";
import {
  copyFileSync,
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
const FOLDKIT_VERSION = "0.170.0";
const OTHER_VERSION = "0.170.1";
const FOLDKIT_TAG_TREE = "1baf242e90e7de155496589850637bcf7e59e4d8";
const REFERENCE_DIR = "repos/foldkit";
const REFERENCE_MANIFEST = `${REFERENCE_DIR}/packages/foldkit/package.json`;
const SKILLS_DIR = ".claude/skills";
const SKILLS = ["foldkit", "generate-program", "audit-program"];
const SKILLS_LOCK = `${SKILLS_DIR}/foldkit-skills.lock.json`;
const VERSION_TEST_NAME = "foldkit-reference.test.ts";
const WEB_INSTRUCTIONS = "web/src/CLAUDE.md";
const SLOW_TEST_TIMEOUT = 180_000;

const temporaryDirs: string[] = [];

const temporaryDir = (name: string) => {
  const dir = mkdtempSync(path.join(tmpdir(), `taimei-${name}-`));
  temporaryDirs.push(dir);
  return dir;
};

afterAll(() => {
  for (const dir of temporaryDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const TOOL_ENV = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("VITEST")),
  ),
  PATH: `${path.join(REPO_ROOT, "node_modules/.bin")}${path.delimiter}${process.env.PATH}`,
};

const run = (cwd: string, command: string, ...args: readonly string[]) =>
  spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    env: TOOL_ENV,
    maxBuffer: 64 * 1024 * 1024,
  });

const repoFiles = (...pathspecs: readonly string[]) =>
  run(
    REPO_ROOT,
    "git",
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "--",
    ...pathspecs,
  )
    .stdout.split("\n")
    .filter((file) => file !== "");

const topLevelEntries = () => [
  ...new Set(repoFiles().map((file) => file.split("/")[0] ?? "")),
  "node_modules",
];

const readIfPresent = (file: string) =>
  existsSync(path.join(REPO_ROOT, file))
    ? readFileSync(path.join(REPO_ROOT, file), "utf8")
    : undefined;

const versionIn = (file: string, key: string): unknown => {
  const source = readIfPresent(file);
  return source === undefined ? undefined : JSON.parse(source)[key];
};

const filesUnder = (dir: string): readonly string[] =>
  existsSync(path.join(REPO_ROOT, dir))
    ? readdirSync(path.join(REPO_ROOT, dir), {
        recursive: true,
        withFileTypes: true,
      })
        .filter((entry) => entry.isFile())
        .map((entry) =>
          path.relative(
            path.join(REPO_ROOT, dir),
            path.join(entry.parentPath, entry.name),
          ),
        )
        .sort()
    : [];

const withoutFrontmatter = (source: string | undefined) =>
  source?.replace(/^---\n[\s\S]*?\n---\n/, "");

const comparableSkillFile = (file: string) =>
  path.basename(file) === "SKILL.md"
    ? withoutFrontmatter(readIfPresent(file))
    : readIfPresent(file);

const skillDifferences = () =>
  SKILLS.flatMap((skill) => {
    const upstream = `${REFERENCE_DIR}/skills/${skill}`;
    const installed = `${SKILLS_DIR}/${skill}`;
    const files = [
      ...new Set([...filesUnder(upstream), ...filesUnder(installed)]),
    ];
    return [
      ...(files.includes("SKILL.md") ? [] : [`${skill}: SKILL.md が無い`]),
      ...files
        .filter(
          (file) =>
            comparableSkillFile(`${upstream}/${file}`) === undefined ||
            comparableSkillFile(`${upstream}/${file}`) !==
              comparableSkillFile(`${installed}/${file}`),
        )
        .map((file) => `${skill}/${file}`),
    ];
  });

const referencePathsNamedBySkills = () => [
  ...new Set(
    SKILLS.flatMap((skill) =>
      filesUnder(`${SKILLS_DIR}/${skill}`).flatMap((file) =>
        [
          ...(readIfPresent(`${SKILLS_DIR}/${skill}/${file}`) ?? "").matchAll(
            /`(repos\/foldkit[\w./@-]*)`/g,
          ),
        ].map((match) => match[1] ?? ""),
      ),
    ),
  ),
];

describe("#676 Foldkit の参照と skill は、入れた版で repo に在る", () => {
  it("AC-001 repos/foldkit の git の tree は、Foldkit の repo の tag foldkit@0.170.0 の tree と同じである", () => {
    const tree = run(
      REPO_ROOT,
      "git",
      "write-tree",
      `--prefix=${REFERENCE_DIR}/`,
    );

    expect(tree.stdout.trim()).toBe(FOLDKIT_TAG_TREE);
  });

  it("AC-002 repos/foldkit の foldkit の package の版は、package.json の foldkit と同じ 0.170.0 である", () => {
    expect({
      installed: versionIn("package.json", "dependencies"),
      reference: versionIn(REFERENCE_MANIFEST, "version"),
    }).toEqual({
      installed: expect.objectContaining({ foldkit: FOLDKIT_VERSION }),
      reference: FOLDKIT_VERSION,
    });
  });

  it("AC-003 .claude/skills の foldkit・generate-program・audit-program は、repos/foldkit/skills の同名の skill と同じ file と本文を持つ", () => {
    expect(skillDifferences()).toEqual([]);
  });

  it("AC-004 skill の lock の版は、package.json の foldkit と同じ 0.170.0 である", () => {
    expect(versionIn(SKILLS_LOCK, "version")).toBe(FOLDKIT_VERSION);
  });

  it("AC-005 skill が指す repos/foldkit の path は、repo に実在する", () => {
    const named = referencePathsNamedBySkills();

    expect(named).not.toEqual([]);
    expect(
      named.filter((file) => !existsSync(path.join(REPO_ROOT, file))),
    ).toEqual([]);
  });
});

const mirrorInto = (
  sourceDir: string,
  targetDir: string,
  copied: readonly string[],
  entries: readonly string[] = readdirSync(sourceDir),
) => {
  mkdirSync(targetDir, { recursive: true });
  for (const entry of entries) {
    const source = path.join(sourceDir, entry);
    const target = path.join(targetDir, entry);
    const nested = copied
      .filter((file) => file.startsWith(`${entry}/`))
      .map((file) => file.slice(entry.length + 1));
    if (copied.includes(entry)) {
      copyFileSync(source, target);
    } else if (nested.length > 0) {
      mirrorInto(source, target, nested);
    } else if (entry !== "vitest.config.ts") {
      symlinkSync(source, target);
    }
  }
};

const versionTestFile = () => repoFiles(`:(glob)**/${VERSION_TEST_NAME}`).at(0);

type Shift = { readonly file: string; readonly from: string };

const versionTestExitCode = (versionTest: string, shift?: Shift) => {
  const fixtureDir = temporaryDir("foldkit-reference");
  const shifted = (shift === undefined ? [] : [shift.file]).filter((file) =>
    existsSync(path.join(REPO_ROOT, file)),
  );
  mirrorInto(
    REPO_ROOT,
    fixtureDir,
    [versionTest, ...shifted],
    topLevelEntries(),
  );
  for (const file of shifted) {
    writeFileSync(
      path.join(fixtureDir, file),
      readFileSync(path.join(fixtureDir, file), "utf8").replace(
        shift?.from ?? "",
        (shift?.from ?? "").replace(FOLDKIT_VERSION, OTHER_VERSION),
      ),
    );
  }
  return run(
    fixtureDir,
    process.execPath,
    path.join(REPO_ROOT, "node_modules/vitest/vitest.mjs"),
    "run",
    "--root",
    ".",
    "--dir",
    path.dirname(versionTest),
    VERSION_TEST_NAME,
  ).status;
};

describe("#676 参照と skill の版が package.json とずれると、版の試験が落ちる", () => {
  it(
    "AC-006 版の試験は今の tree で通り、package.json の foldkit・repos/foldkit の版・lock の版のどれか 1 つを別の版にすると落ちる",
    () => {
      const versionTest = versionTestFile();

      expect(versionTest).toBeDefined();
      expect({
        asWritten: versionTestExitCode(versionTest ?? ""),
        installedShifted: versionTestExitCode(versionTest ?? "", {
          file: "package.json",
          from: `"foldkit": "${FOLDKIT_VERSION}"`,
        }),
        referenceShifted: versionTestExitCode(versionTest ?? "", {
          file: REFERENCE_MANIFEST,
          from: `"version": "${FOLDKIT_VERSION}"`,
        }),
        lockShifted: versionTestExitCode(versionTest ?? "", {
          file: SKILLS_LOCK,
          from: `"version": "${FOLDKIT_VERSION}"`,
        }),
      }).toEqual({
        asWritten: 0,
        installedShifted: 1,
        referenceShifted: 1,
        lockShifted: 1,
      });
    },
    SLOW_TEST_TIMEOUT,
  );
});

const CANARY_SOURCE = `var canary: any = 1
switch (canary) { default: }
export const wrongType: number = "not a number"
`;
const CANARY_TEST = `import { it } from "vitest";

it("canary", () => {});
`;
const INSIDE_REPOS = "repos/canary";
const OUTSIDE_REPOS = "canary-control";
const OUTSIDE_REPOS_IN_WEB = "web/canary-control.ts";

const linkChildren = (sourceDir: string, targetDir: string) => {
  mkdirSync(targetDir);
  for (const entry of readdirSync(sourceDir)) {
    symlinkSync(path.join(sourceDir, entry), path.join(targetDir, entry));
  }
};

const canaryFixtureDirs: string[] = [];

const canaryFixtureDir = () => {
  const built = canaryFixtureDirs[0];
  if (built !== undefined) {
    return built;
  }
  const fixtureDir = temporaryDir("repos-canary");
  for (const entry of topLevelEntries()) {
    const source = path.join(REPO_ROOT, entry);
    const target = path.join(fixtureDir, entry);
    if (entry === "repos") {
      continue;
    }
    if (statSync(source).isFile()) {
      copyFileSync(source, target);
    } else if (entry === "web") {
      linkChildren(source, target);
    } else {
      symlinkSync(source, target);
    }
  }
  for (const dir of [INSIDE_REPOS, OUTSIDE_REPOS]) {
    mkdirSync(path.join(fixtureDir, dir), { recursive: true });
    writeFileSync(path.join(fixtureDir, dir, "canary.ts"), CANARY_SOURCE);
    writeFileSync(path.join(fixtureDir, dir, "canary.test.ts"), CANARY_TEST);
  }
  writeFileSync(path.join(fixtureDir, OUTSIDE_REPOS_IN_WEB), CANARY_SOURCE);
  canaryFixtureDirs.push(fixtureDir);
  return fixtureDir;
};

const scripts: Readonly<Record<string, string>> = JSON.parse(
  readFileSync(path.join(REPO_ROOT, "package.json"), "utf8"),
).scripts;

const lintCommandOf = (tool: string) =>
  (scripts.lint ?? "")
    .split("&&")
    .map((command) => command.trim())
    .find((command) => command.split(" ")[0] === tool) ?? "false";

const visitedBy = (command: string, outside = OUTSIDE_REPOS) => {
  const result = run(canaryFixtureDir(), "sh", "-c", command);
  const output = `${result.stdout}${result.stderr}`;
  return {
    insideRepos: output.includes(INSIDE_REPOS),
    outsideRepos: output.includes(outside),
  };
};

const ONLY_OUTSIDE_REPOS = { insideRepos: false, outsideRepos: true };

describe("#676 道具は repos/ を走査しない", () => {
  it(
    "AC-008 bun run lint の Biome は、repos/ の下の file を検査せず、外の同じ file を検査する",
    () => {
      expect(
        visitedBy(`${lintCommandOf("biome")} --max-diagnostics=none`),
      ).toEqual(ONLY_OUTSIDE_REPOS);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "AC-008 bun run lint の fallow は、repos/ の下の file を解析の対象にせず、外の同じ file を対象にする",
    () => {
      expect(visitedBy("fallow list --files")).toEqual(ONLY_OUTSIDE_REPOS);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "AC-008 bun run typecheck は、repos/ の下の型エラーを出さず、外の同じ型エラーを出す",
    () => {
      expect(visitedBy(scripts.typecheck ?? "false")).toEqual(
        ONLY_OUTSIDE_REPOS,
      );
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "AC-008 bun run test:db の vitest は、repos/ の下の試験を拾わず、外の同じ試験を拾う",
    () => {
      expect(visitedBy("vitest list --filesOnly")).toEqual(ONLY_OUTSIDE_REPOS);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "AC-009 bun run lint の oxlint は、repos/ の下の file を検査せず、web/ の下の同じ file を検査する",
    () => {
      expect(visitedBy(lintCommandOf("oxlint"), OUTSIDE_REPOS_IN_WEB)).toEqual(
        ONLY_OUTSIDE_REPOS,
      );
    },
    SLOW_TEST_TIMEOUT,
  );
});

const gitGrepLines = (pattern: string, ...pathspecs: readonly string[]) => {
  const result = run(
    REPO_ROOT,
    "git",
    "grep",
    "--untracked",
    "-n",
    "-E",
    pattern,
    "--",
    ...pathspecs,
  );
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git grep ${pattern}: ${result.stderr}`);
  }
  return result.stdout.split("\n").filter((line) => line !== "");
};

const DIRS_WITH_OWN_INSTRUCTIONS = [
  ".claude",
  ".github",
  "biome-plugins",
  "db",
  "docs",
  "drizzle",
  "e2e",
  "infra",
  "lint",
  "scripts",
  "src",
  "testing",
  "web",
];

describe("#676 Foldkit の書き方は skill が持ち、CLAUDE.md は skill を指すだけにする", () => {
  it("AC-011 web/src/CLAUDE.md は、テストを書かせない指示を書かない", () => {
    expect(gitGrepLines("テストは書かない", WEB_INSTRUCTIONS)).toEqual([]);
  });

  it("AC-012 web/src/CLAUDE.md は、Foldkit の code を書く時に .claude/skills の skill を読むよう指す", () => {
    const instructions = readIfPresent(WEB_INSTRUCTIONS) ?? "";

    expect({
      namesFoldkit: instructions.includes("Foldkit"),
      namesSkill: instructions.includes("skill"),
      namesSkillsDir: instructions.includes(SKILLS_DIR),
    }).toEqual({ namesFoldkit: true, namesSkill: true, namesSkillsDir: true });
  });

  it("AC-013 taimei の CLAUDE.md と AGENTS.md は、Foldkit の構成要素の名前 (Model・Message・Command・Submodel・Runtime) を書かない", () => {
    expect(
      gitGrepLines(
        "Model|Message|Command|Submodel|Runtime",
        "CLAUDE.md",
        "AGENTS.md",
        ...DIRS_WITH_OWN_INSTRUCTIONS.flatMap((dir) => [
          `:(glob)${dir}/**/CLAUDE.md`,
          `:(glob)${dir}/**/AGENTS.md`,
        ]),
      ),
    ).toEqual([]);
  });
});
