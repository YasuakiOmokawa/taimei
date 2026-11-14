import { spawnSync } from "node:child_process";
import path from "node:path";
import { expect, it } from "vitest";
import { CRASH_MESSAGE } from "../crash-view";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");

it("回復できない失敗の文言を書く製品の file は crash-view.ts だけで、入口と Foldkit の失敗の画面はそこから読む", () => {
  const result = spawnSync(
    "git",
    ["grep", "--untracked", "-l", "-F", CRASH_MESSAGE, "--", "web/src"],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );

  if (result.status !== 0) {
    throw new Error(`git grep が失敗した: ${result.stderr}`);
  }
  expect(
    result.stdout
      .split("\n")
      .filter((file) => file !== "" && !file.includes("/__tests__/")),
  ).toEqual(["web/src/shared/crash-view.ts"]);
});
