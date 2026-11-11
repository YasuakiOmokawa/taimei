import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const SKILL_VERSION =
  /^---\n(?:.*\n)*?  foldkit-version: (\S+)\n(?:.*\n)*?---\n/;
const FOLDKIT_SKILLS = ["foldkit", "generate-program", "audit-program"];
const SUBTREE_PACKAGE_DIRS: Readonly<Record<string, string>> = {
  foldkit: "foldkit",
  "@foldkit/ui": "ui",
};

type Manifest = {
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
};
type Versioned = { readonly version: string };
type SkillsLock = { readonly version: string; readonly sha256: string };

const readRepoFile = (file: string) =>
  readFileSync(path.join(REPO_ROOT, file), "utf8");

const manifest: Manifest = JSON.parse(readRepoFile("package.json"));
const installed = { ...manifest.devDependencies, ...manifest.dependencies };
const installedFoldkitVersion = installed.foldkit ?? "";

const subtreePackage = (packageDir: string): Versioned =>
  JSON.parse(readRepoFile(`repos/foldkit/packages/${packageDir}/package.json`));

const skillsLock: SkillsLock = JSON.parse(
  readRepoFile(".claude/skills/foldkit-skills.lock.json"),
);

const sha256 = (content: string | Buffer) =>
  createHash("sha256").update(content).digest("hex");

const skillFiles = () =>
  FOLDKIT_SKILLS.flatMap((skill) =>
    readdirSync(path.join(REPO_ROOT, ".claude/skills", skill), {
      recursive: true,
      withFileTypes: true,
    })
      .filter((entry) => entry.isFile())
      .map((entry) =>
        path.relative(REPO_ROOT, path.join(entry.parentPath, entry.name)),
      ),
  ).sort();

const skillsSha256 = () =>
  sha256(
    skillFiles()
      .map(
        (file) =>
          `${sha256(readFileSync(path.join(REPO_ROOT, file)))}  ${file}\n`,
      )
      .join(""),
  );

describe("agent が読む Foldkit の参照は、入れた版と一致する (ずれたら bash scripts/update-foldkit-reference.sh で取り直す)", () => {
  it("package.json の foldkit は範囲を持たない版で固定する", () => {
    expect(installedFoldkitVersion).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it.each(
    Object.entries(SUBTREE_PACKAGE_DIRS).filter(
      ([packageName]) => packageName in installed,
    ),
  )("repos/foldkit の %s は、入れた版と一致する", (packageName, packageDir) => {
    expect(subtreePackage(packageDir).version).toBe(installed[packageName]);
  });

  it("web/src/CLAUDE.md は Foldkit の版を書かない (版は package.json と repos/foldkit だけが持つ)", () => {
    expect(readRepoFile("web/src/CLAUDE.md")).not.toMatch(/foldkit@\d/);
  });

  it.each(FOLDKIT_SKILLS)(
    ".claude/skills/%s は入れた版の tag から写した skill である",
    (skill) => {
      expect(
        readRepoFile(`.claude/skills/${skill}/SKILL.md`).match(
          SKILL_VERSION,
        )?.[1],
      ).toBe(installedFoldkitVersion);
    },
  );

  it("skill を取り直した版は、入れた版と一致する", () => {
    expect(skillsLock.version).toBe(installedFoldkitVersion);
  });

  it("skill の中身は scripts/update-foldkit-reference.sh が取り直したときの hash と一致する (手で写したり書き換えたりすると落ちる)", () => {
    expect(skillsSha256()).toBe(skillsLock.sha256);
  });

  it.each(["FOLDKIT.md", "web/FOLDKIT.md", "web/.mcp.json"])(
    "Foldkit の scaffold が置く %s を repo に持ち込まない",
    (file) => {
      expect(existsSync(path.join(REPO_ROOT, file))).toBe(false);
    },
  );

  it("repo の .mcp.json に Foldkit の DevTools の MCP server を足さない", () => {
    expect(readRepoFile(".mcp.json")).not.toMatch(/foldkit/i);
  });
});
