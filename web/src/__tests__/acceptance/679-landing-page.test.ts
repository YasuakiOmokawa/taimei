import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Effect, Option } from "effect";
import { TestClock } from "effect/testing";
import {
  all,
  altText,
  click,
  expectAll,
  expect as expectInScene,
  filter,
  first,
  given,
  nth,
  role,
  scene,
  text,
} from "foldkit/scene";
import { fromString } from "foldkit/url";
import { afterEach, describe, expect, it, vi } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");
const LANDING_DIR = "web/src/landing";
const ORIGIN = "https://app.example.com";

const YEAR_OF_FIXED_CLOCK = 2031;
const FIXED_CLOCK_MS = Date.UTC(YEAR_OF_FIXED_CLOCK, 5, 15, 12);

const SERVICES_OF_REACT_LANDING = [
  { title: "癒し", description: "忙しい現代人にやすらぎを。" },
  { title: "収入アップ", description: "フリーランスで年収1000万円。" },
  { title: "斧投げ", description: "物理的にマサカリを投げよう。" },
];

type PublicApplication = typeof import("../../app/public/main");
type PublicModel = ReturnType<PublicApplication["init"]>["model"];

const urlOf = (pathname: string) =>
  Option.getOrThrowWith(
    fromString(`${ORIGIN}${pathname}`),
    () => new Error(`URL として読めない: ${pathname}`),
  );

const startedAt = async (
  application: PublicApplication,
  pathname: string,
): Promise<PublicModel> => {
  const opened = application.init(urlOf(pathname));
  const startupMessages = await Promise.all(
    (opened.commands ?? []).map((command) =>
      Effect.runPromise(
        Effect.gen(function* () {
          yield* TestClock.setTime(FIXED_CLOCK_MS);
          return yield* command.effect;
        }).pipe(Effect.provide(TestClock.layer())),
      ),
    ),
  );
  return startupMessages.reduce(
    (current, startupMessage) =>
      application.update(current, startupMessage).model,
    opened.model,
  );
};

const titleOf = (application: PublicApplication, current: PublicModel) => {
  const titles: string[] = [];
  scene(
    {
      update: application.update,
      view: (shown, h) => {
        const document = application.view(shown, h);
        titles.push(document.title);
        return document;
      },
    },
    given(current),
  );
  return titles.at(-1);
};

const gitGrepLines = (pattern: string, ...pathspecs: readonly string[]) => {
  const result = spawnSync(
    "git",
    ["grep", "--untracked", "-n", "-E", pattern, "--", ...pathspecs],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git grep ${pattern}: ${result.stderr}`);
  }
  return result.stdout.split("\n").filter((line) => line !== "");
};

const testSourcesUnder = (dir: string) =>
  readdirSync(path.join(REPO_ROOT, dir), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && /\.test\.tsx?$/.test(entry.name))
    .map((entry) =>
      readFileSync(path.join(entry.parentPath, entry.name), "utf8"),
    );

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("#679 LP の page と application public の /", () => {
  it("AC-001 application public で / を開くと、今の LP と同じ文面が出る", async () => {
    const application = await import("../../app/public/main");
    const serviceTitles = all.role("heading", { level: 3 });

    scene(
      { update: application.update, view: application.view },
      given(await startedAt(application, "/")),
      expectInScene(role("heading", { level: 1 })).toHaveText(
        "心安らかなソリューション",
      ),
      expectInScene(text("それが Taimei")).toExist(),
      expectInScene(role("link", { name: "Taimei を試す" })).toExist(),
      expectInScene(role("heading", { level: 2 })).toHaveText(
        "Taimei でできること",
      ),
      expectInScene(text("全人類待望のサービスです")).toExist(),
      expectAll(serviceTitles).toHaveCount(SERVICES_OF_REACT_LANDING.length),
      ...SERVICES_OF_REACT_LANDING.flatMap((service, index) => [
        expectInScene(nth(serviceTitles, index)).toHaveText(service.title),
        expectInScene(text(service.description)).toExist(),
        expectInScene(text(String(index + 1))).toExist(),
      ]),
      expectInScene(altText("myservicelogo")).toHaveAttr(
        "src",
        "/icons/my-service-logo.png",
      ),
      expectInScene(altText("ヒーローイメージ")).toHaveAttr(
        "src",
        "/icons/hero-image.webp",
      ),
      expectInScene(role("button", { name: "メニュー" })).toExist(),
      expectInScene(role("link", { name: "プライバシーポリシー" })).toExist(),
    );
  });

  it("AC-002 application public で / を開いて起動の処理が済むと、footer にその時の年の著作権の表示が出る", async () => {
    const application = await import("../../app/public/main");

    scene(
      { update: application.update, view: application.view },
      given(await startedAt(application, "/")),
      expectInScene(
        text(`© ${YEAR_OF_FIXED_CLOCK} Taimei All rights reserved.`),
      ).toExist(),
    );
  });

  it("AC-003 / の画面の link は、今の LP と同じ行き先を指す", async () => {
    const application = await import("../../app/public/main");
    const detailLinks = all.role("link", { name: "詳細を見る" });
    const logoLinks = filter(all.role("link"), {
      has: altText("myservicelogo"),
    });

    scene(
      { update: application.update, view: application.view },
      given(await startedAt(application, "/")),
      expectAll(logoLinks).toHaveCount(1),
      expectInScene(first(logoLinks)).toHaveAttr("href", "/"),
      expectInScene(role("link", { name: "ログイン" })).toHaveAttr(
        "href",
        "/auth",
      ),
      expectInScene(role("link", { name: "Taimei を試す" })).toHaveAttr(
        "href",
        "/auth",
      ),
      expectAll(detailLinks).toHaveCount(SERVICES_OF_REACT_LANDING.length),
      ...SERVICES_OF_REACT_LANDING.map((_service, index) =>
        expectInScene(nth(detailLinks, index)).toHaveAttr(
          "href",
          `/service/${index + 1}`,
        ),
      ),
      expectInScene(role("link", { name: "プライバシーポリシー" })).toHaveAttr(
        "href",
        "/privacy",
      ),
    );
  });

  it("AC-004 / の画面でメニューの button を押すと、/auth を指すログインがもう 1 つ出る", async () => {
    const application = await import("../../app/public/main");
    const signInLinks = all.role("link", { name: "ログイン" });

    scene(
      { update: application.update, view: application.view },
      given(await startedAt(application, "/")),
      expectAll(signInLinks).toHaveCount(1),
      click(role("button", { name: "メニュー" })),
      expectAll(signInLinks).toHaveCount(2),
      expectInScene(nth(signInLinks, 0)).toHaveAttr("href", "/auth"),
      expectInScene(nth(signInLinks, 1)).toHaveAttr("href", "/auth"),
    );
  });

  it("AC-005 application public で / を開くと LP が出て、title は Taimei", async () => {
    const application = await import("../../app/public/main");
    const opened = await startedAt(application, "/");

    scene(
      { update: application.update, view: application.view },
      given(opened),
      expectInScene(role("heading", { level: 1 })).toContainText("心安らかな"),
    );
    expect(titleOf(application, opened)).toBe("Taimei");
  });

  it("AC-008 application public を / で開いて起動の処理を流しても、通信しない", async () => {
    const fetchCalls: unknown[][] = [];
    vi.stubGlobal("fetch", (...args: unknown[]) => {
      fetchCalls.push(args);
      return Promise.reject(new Error("LP は通信しない"));
    });
    const application = await import("../../app/public/main");

    const opened = await startedAt(application, "/");

    scene(
      { update: application.update, view: application.view },
      given(opened),
    );
    expect(fetchCalls).toEqual([]);
  });

  it("AC-009 application public と公開ページの page の code に、契約と API の client が無い", () => {
    expect(
      gitGrepLines(
        "spa-contract|api-internal|@/api|HttpApiClient",
        "web/src/app/public",
        "web/src/landing/pages",
        "web/src/privacy/pages",
      ),
    ).toEqual([]);
  });

  it("AC-011 web/src/landing の下に、Foldkit の Story で書いた試験と Scene で書いた試験がある", () => {
    const sources = testSourcesUnder(LANDING_DIR);

    expect({
      story: sources.some((source) => source.includes('"foldkit/story"')),
      scene: sources.some((source) => source.includes('"foldkit/scene"')),
    }).toEqual({ story: true, scene: true });
  });
});
