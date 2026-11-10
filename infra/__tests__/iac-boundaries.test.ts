import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const gitGrepLines = (pattern: string, ...pathspecs: string[]) => {
  try {
    return execFileSync(
      "git",
      ["grep", "--untracked", "-n", "-E", pattern, "--", ...pathspecs],
      { encoding: "utf8" },
    )
      .trim()
      .split("\n");
  } catch (error) {
    if ((error as { status?: number }).status === 1) return [];
    throw error;
  }
};

describe("staging と本番の差は表の値だけに現れる", () => {
  it("定義は stage の名前で分岐しない", () => {
    expect(
      gitGrepLines('"(staging|production)"', "infra/alchemy.run.ts"),
    ).toEqual([]);
  });

  it("infra は本番の値を写さず wrangler.jsonc から導く", () => {
    expect(
      gitGrepLines(
        'app\\.taimei-code\\.com|auth\\.taimei-code\\.com|src/worker\\.ts|"taimei-auth"',
        "infra",
        ":!infra/__tests__",
      ),
    ).toEqual([]);
  });
});

describe("deploy は定義を通る", () => {
  it("workflow は定義を通らない wrangler の deploy と、取り込みの --adopt を書かない", () => {
    expect(
      gitGrepLines(
        "wrangler deploy( |$)|wrangler versions upload|--adopt",
        ".github/workflows",
      ),
    ).toEqual([]);
  });

  it("deploy の workflow は Worker の名前と URL を infra/stages.ts から引き、直書きしない", () => {
    expect(
      gitGrepLines(
        "taimei-staging|workers\\.dev|app\\.taimei-code\\.com",
        ".github/workflows/deploy.yml",
      ),
    ).toEqual([]);
  });

  it("bundle の出力先と script の旧名 (staging だけの bundle) が残らない", () => {
    expect(
      gitGrepLines(
        "staging-bundle|STAGING_BUNDLE_ENTRY|build-staging-bundle",
        ".",
        ":!infra/__tests__/iac-boundaries.test.ts",
      ),
    ).toEqual([]);
  });
});

const filesOf = (lines: readonly string[]) => [
  ...new Set(lines.map((line) => line.split(":")[0] ?? "")),
];

describe("repos/ (agent が読む Foldkit の source の写し) は本番の build に入らない", () => {
  it("bundle を build する job の checkout は repos/ を除く", () => {
    const workflows = filesOf(
      gitGrepLines(
        "build-bundle\\.sh|bun run build|vite build",
        ".github/workflows",
      ),
    ).map((workflow) => ({
      workflow,
      checkouts: gitGrepLines("uses: actions/checkout@", workflow).length,
      wholeRoot: gitGrepLines("^ +/\\*$", workflow).length,
      withoutRepos: gitGrepLines("^ +!/repos/$", workflow).length,
      nonCone: gitGrepLines("sparse-checkout-cone-mode: false", workflow)
        .length,
    }));

    expect(workflows.map(({ workflow }) => workflow)).toContain(
      ".github/workflows/deploy.yml",
    );
    expect(
      workflows.filter(({ checkouts, wholeRoot, withoutRepos, nonCone }) =>
        [wholeRoot, withoutRepos, nonCone].some((count) => count !== checkouts),
      ),
    ).toEqual([]);
  });
});
