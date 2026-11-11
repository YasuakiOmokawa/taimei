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

const DIRECT_STARTS = `import { Runtime } from "foldkit";
import { Runtime as Aliased } from "foldkit";
import * as Foldkit from "foldkit";
import * as FoldkitRuntime from "foldkit/runtime";
import { hydrate } from "foldkit/runtime";
import type { Runtime as AliasedType } from "foldkit";
import type * as FoldkitTypes from "foldkit";

export type Config = AliasedType.RoutingConfig<never> | FoldkitTypes.Html.Html;

export const starts = [
  hydrate,
  Runtime.run,
  Runtime.makeApplication,
  Runtime.makeElement,
  Runtime.embed,
  Runtime.hydrate,
  Aliased,
  Foldkit,
  FoldkitRuntime,
];
`;

const taimeiLinesOf = (file: string, source: string) => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "taimei-oxlint-plugin-"));
  try {
    for (const entry of [".oxlintrc.json", "lint", "node_modules"]) {
      symlinkSync(path.join(REPO_ROOT, entry), path.join(fixtureDir, entry));
    }
    mkdirSync(path.dirname(path.join(fixtureDir, file)), { recursive: true });
    writeFileSync(path.join(fixtureDir, file), source);
    const report: OxlintReport = JSON.parse(
      spawnSync(
        path.join(REPO_ROOT, "node_modules/.bin/oxlint"),
        ["--disable-nested-config", "--format", "json"],
        { cwd: fixtureDir, encoding: "utf8" },
      ).stdout,
    );
    return report.diagnostics
      .filter(
        ({ filename, code }) => filename === file && code.startsWith("taimei("),
      )
      .flatMap(({ labels }) => labels.map(({ span }) => span.line))
      .sort((left, right) => left - right);
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
};

it("Command の execute と Effect.sync の外の browser の global と、timer の行だけが指摘される", () => {
  expect(taimeiLinesOf("web/src/probe/Page.ts", FOLDKIT_PAGE)).toEqual([
    10, 12,
  ]);
});

it("web/src/app/start-application.ts の外では、Foldkit の起動の関数 (run・hydrate・embed・makeApplication・makeElement) の import と呼び出し、Runtime の別名と namespace の import の行がすべて指摘され、型だけの import は指摘されない", () => {
  expect(taimeiLinesOf("web/src/app/public/entry.ts", DIRECT_STARTS)).toEqual([
    2, 3, 4, 5, 13, 14, 15, 16, 17,
  ]);
});

const COMMENTED = `import type { Html } from "foldkit/html";

// なぜそうするかの説明
export type Page = Html;

/* 区切り */
// @ts-expect-error
export const page: Page = 1;

// biome-ignore lint/suspicious/noExplicitAny: Biome が lint しない file では効かない
export const loose: any = 1;
`;

it("web の Foldkit の file では、この file に効く directive でないコメントの行 (Biome が lint しない file の biome-ignore を含む) だけが指摘される", () => {
  expect(taimeiLinesOf("web/src/probe/commented.ts", COMMENTED)).toEqual([
    3, 6, 10,
  ]);
});
