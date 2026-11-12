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

const LEAVING_DOCUMENT = `import { Effect } from "effect";
import { Navigation } from "foldkit";
import { load } from "foldkit/navigation";
import * as FoldkitNavigation from "foldkit/navigation";
import { type leaveSpaToSignIn } from "../../shared/leave-spa";

export type Leave = typeof leaveSpaToSignIn;
export const loadByFoldkit = load;
export const loadByNamespace = Navigation.load;
export const loadByModule = FoldkitNavigation.load;
export const replace = Effect.sync(() => window.location.replace("/auth"));
export const assignHref = Effect.sync(() => {
  window.location.href = "/auth";
});
export const assignLocation = Effect.sync(() => {
  window.location = "/auth";
});
export const appendToPathname = Effect.sync(() => {
  location.pathname += "/auth";
});
export const readHref = Effect.sync(() => window.location.href);
`;

it("web/src/shared/leave-spa.ts の外では、foldkit の load (import・Navigation.load・namespace の import)・location.replace・location とその property への代入の行が指摘され、口の型だけの import と location.href の読み取りは指摘されない", () => {
  expect(taimeiLinesOf("web/src/probe/leaving.ts", LEAVING_DOCUMENT)).toEqual([
    3, 4, 9, 11, 13, 16, 19,
  ]);
});

const API_CLIENT_BESIDE_FOLDKIT_TYPES = `import type { Html } from "foldkit/html";
import { type HtmlBuilder } from "foldkit/html";
import { SpaHttpClient } from "../shared/spa-http-client";

export type Page = Html | HtmlBuilder<never>;
export const client = SpaHttpClient;
`;

it("Foldkit の型だけを import する file は Foldkit の file に数えず、API の client の import の行が指摘される", () => {
  expect(
    taimeiLinesOf("web/src/probe/client.ts", API_CLIENT_BESIDE_FOLDKIT_TYPES),
  ).toEqual([3]);
});

const FAILURE_LOOKUPS_IN_PAGE = `import { Cause, Exit } from "effect";

export const fromCause = (cause: Cause.Cause<unknown>) => Cause.findError(cause);
export const fromExit = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.findErrorOption(exit);
export const isFailure = Exit.isFailure;
`;

it("web/src/shared/failure-message.ts の外では、Cause と Exit から失敗を取り出す行が指摘され、失敗かどうかを見るだけの行は指摘されない", () => {
  expect(
    taimeiLinesOf("web/src/probe/lookup.ts", FAILURE_LOOKUPS_IN_PAGE),
  ).toEqual([3, 5]);
});

const KEYED_ELEMENTS = `import type { Html, HtmlBuilder } from "foldkit/html";

export const rowViews = <Message>(
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  h.keyed("button")("a", []),
  h.keyed("input")("b", []),
  h.keyed("select")("c", []),
  h.keyed("textarea")("d", []),
  h.keyed("svg")("e", []),
  h.keyed("li")("f", []),
];
`;

it("h.keyed で書いた form の要素と svg は、h.<要素> と同じ場所でだけ指摘されず、ほかの要素の h.keyed は指摘されない", () => {
  expect(
    taimeiLinesOf("web/src/dashboard/pages/Probe.ts", KEYED_ELEMENTS),
  ).toEqual([6, 7, 8, 9, 10]);
  expect(
    taimeiLinesOf("web/src/shared/ui/probe-view.ts", KEYED_ELEMENTS),
  ).toEqual([10]);
  expect(
    taimeiLinesOf("web/src/shared/ui/icon-view.ts", KEYED_ELEMENTS),
  ).toEqual([]);
});
