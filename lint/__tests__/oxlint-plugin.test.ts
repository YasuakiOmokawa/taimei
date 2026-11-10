import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import taimeiPlugin from "../oxlint-plugin.mjs";

const REPO_ROOT = path.join(import.meta.dirname, "../..");

const enabledTaimeiRules = () =>
  [
    ...new Set(
      [
        ...readFileSync(
          path.join(REPO_ROOT, ".oxlintrc.json"),
          "utf8",
        ).matchAll(/"taimei\/([a-z0-9-]+)"/g),
      ].map(([, rule]) => rule),
    ),
  ].sort();

it("この repo の oxlint の plugin の rule は、すべて .oxlintrc.json で使い、使う rule はすべて plugin にある", () => {
  expect(Object.keys(taimeiPlugin.rules).sort()).toEqual(enabledTaimeiRules());
});

const FOLDKIT_PAGE = `import { Effect } from "effect";
import { Command } from "foldkit";

export const ReadTitle = Command.define("ReadTitle")({
  execute: () => Effect.succeed(document.title),
});

export const readLater = Effect.sync(() => window.scrollY);

export const titleAtDecisionTime = () => document.title;

export const later = (run: () => void) => setTimeout(run, 1);
`;

type OxlintReport = {
  readonly diagnostics: readonly {
    readonly code: string;
    readonly filename: string;
    readonly labels: readonly { readonly span: { readonly line: number } }[];
  }[];
};

it("Command の execute と Effect.sync の外の browser の global と、timer の行だけが指摘される", () => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "taimei-oxlint-plugin-"));
  try {
    for (const entry of [".oxlintrc.json", "lint", "node_modules"]) {
      symlinkSync(path.join(REPO_ROOT, entry), path.join(fixtureDir, entry));
    }
    mkdirSync(path.join(fixtureDir, "web/src/probe"), { recursive: true });
    writeFileSync(path.join(fixtureDir, "web/src/probe/Page.ts"), FOLDKIT_PAGE);
    const report: OxlintReport = JSON.parse(
      spawnSync(
        path.join(REPO_ROOT, "node_modules/.bin/oxlint"),
        ["--disable-nested-config", "--format", "json"],
        { cwd: fixtureDir, encoding: "utf8" },
      ).stdout,
    );
    const taimeiLinesOf = (file: string) =>
      report.diagnostics
        .filter(
          ({ filename, code }) =>
            filename === file && code.startsWith("taimei("),
        )
        .flatMap(({ labels }) => labels.map(({ span }) => span.line))
        .sort((left, right) => left - right);

    expect(taimeiLinesOf("web/src/probe/Page.ts")).toEqual([10, 12]);
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});
