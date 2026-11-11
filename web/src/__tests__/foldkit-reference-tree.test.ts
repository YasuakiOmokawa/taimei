import { spawnSync } from "node:child_process";
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

type ReferenceLock = { readonly tree: string };

const git = (env: NodeJS.ProcessEnv, ...args: readonly string[]) =>
  spawnSync("git", args, { cwd: REPO_ROOT, encoding: "utf8", env });

const treeWithoutLockingTheIndex = (dir: string) => {
  const scratchDir = mkdtempSync(path.join(tmpdir(), "taimei-foldkit-tree-"));
  try {
    const indexCopy = path.join(scratchDir, "index");
    copyFileSync(
      path.resolve(
        REPO_ROOT,
        git(process.env, "rev-parse", "--git-path", "index").stdout.trim(),
      ),
      indexCopy,
    );
    const tree = git(
      { ...process.env, GIT_INDEX_FILE: indexCopy },
      "write-tree",
      `--prefix=${dir}/`,
    );
    return tree.status === 0 ? tree.stdout.trim() : tree.stderr;
  } finally {
    rmSync(scratchDir, { recursive: true, force: true });
  }
};

it("repos/foldkit の中身は、scripts/update-foldkit-reference.sh が取り直した tag の tree と同じである (.gitleaks.toml と .gitguardian.yaml がこの dir を secret の検査から外すので、手で足したり書き換えたりした file があれば落とす)", () => {
  const lock: ReferenceLock = JSON.parse(
    readFileSync(
      path.join(REPO_ROOT, ".claude/skills/foldkit-skills.lock.json"),
      "utf8",
    ),
  );

  expect(treeWithoutLockingTheIndex("repos/foldkit")).toBe(lock.tree);
});
