import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");
const FOLDKIT_SKILLS = ["foldkit", "generate-program", "audit-program"];
const SKILL_DIR_REFERENCE = /\$\{CLAUDE_SKILL_DIR\}\/([\w./@-]+)/g;

const readRepoFile = (file: string) =>
  readFileSync(path.join(REPO_ROOT, file), "utf8");

const skillMarkdownFiles = () =>
  FOLDKIT_SKILLS.flatMap((skill) =>
    readdirSync(path.join(REPO_ROOT, ".claude/skills", skill), {
      recursive: true,
      withFileTypes: true,
    })
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) =>
        path.relative(REPO_ROOT, path.join(entry.parentPath, entry.name)),
      ),
  );

const pathsReferencedFromSkillDir = () =>
  skillMarkdownFiles().flatMap((file) =>
    [...readRepoFile(file).matchAll(SKILL_DIR_REFERENCE)].map((match) =>
      path.join(path.dirname(file), (match[1] ?? "").replace(/\.+$/, "")),
    ),
  );

describe("写した Foldkit の repo は、taimei の agent が読む skill と噛み合う", () => {
  it("写した skill が自分の dir から指す path は、どれも在る (無い dir を指したら .claude/ に repos/foldkit への symlink を足す)", () => {
    expect(
      pathsReferencedFromSkillDir().filter(
        (referenced) => !existsSync(path.join(REPO_ROOT, referenced)),
      ),
    ).toEqual([]);
  });

});
