import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Option } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import {
  all,
  altText,
  click,
  expectAll,
  expect as expectInScene,
  given,
  nth,
  role,
  scene,
  selector,
  text,
} from "foldkit/scene";
import { given as givenInStory, message, model, story } from "foldkit/story";
import { fromString } from "foldkit/url";
import { describe, expect, it } from "vitest";
import { privacyFacts } from "../../privacy/facts";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");
const REACT_PRIVACY_TEST = "web/src/privacy/__tests__/privacy-page.test.ts";
const PRIVACY_DIR = "web/src/privacy";

const BUTTON_BASE_CLASS =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";
const MENU_BUTTON_CLASS_OF_REACT_LANDING = `${BUTTON_BASE_CLASS} hover:bg-accent hover:text-accent-foreground h-10 w-10 md:hidden`;
const TRY_LINK_CLASS_OF_REACT_LANDING =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-md text-base px-8 py-6";
const DETAIL_LINK_CLASS_OF_REACT_LANDING =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-primary underline-offset-4 hover:underline h-11 rounded-md px-8 mt-2";

const ICON_ATTRIBUTES_OF_REACT_LANDING = {
  xmlns: "http://www.w3.org/2000/svg",
  width: "24",
  height: "24",
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
  "aria-hidden": "true",
};
const ARROW_RIGHT_PATHS_OF_REACT_LANDING = ["M5 12h14", "m12 5 7 7-7 7"];

const PRIVACY_TITLE = "プライバシーポリシー";
const PRIVACY_SECTION_TITLES = [
  "預かる情報",
  "使い道",
  "見える人",
  "保存場所",
  "消す時期",
  "問い合わせ先",
];
const PRIVACY_PARAGRAPHS = [
  "認証 (taimei-auth) は、名前・メールアドレスと、所属する事業所での役割を預かります。taimei は事業所ごとに、チーム・スキル・チームへの割り当てと、各メンバーが自分について記入したレベルと学びたいを預かります。",
  "星取表と、チームとしての集計 (偏り、スキルごとの学びたいの人数) の表示だけに使います。レベルと学びたいを、人の評価・ランキング・エクスポートに使いません。人ごとの合計も作りません。",
  "星取表を見られるのは、同じ事業所の管理者 (OWNER・ADMIN) と、そのチームに割り当てられたメンバーです。レベルと学びたいを書けるのは本人だけで、管理者も他人の行を書き換えられません。ほかの事業所からは見えません。",
  `除名・退会・事業所の削除の後、1 時間ごとの処理で、taimei にあるその人・その事業所のデータを物理削除します (通常は数時間以内)。データベースの復元用の履歴には、消した後も ${privacyFacts.backupRetention}残ります。チーム・スキル・割り当てを消した時は、そこに記入したレベルと学びたいもすぐに消えます。`,
  privacyFacts.contact,
];
const PRIVACY_STORAGE_LOCATIONS = [
  `データベース (taimei): Neon (${privacyFacts.databaseRegion})`,
  `データベース (認証): Neon (${privacyFacts.authDatabaseRegion})`,
  "アプリ: Cloudflare",
  "認証: Cloudflare",
  "メールの送信: Resend",
  "エラーの記録: Sentry (米国)。入力した内容は送らない",
];
const REACT_PRIVACY_TEST_NAMES = [
  "taimei のデータベースはシンガポールにあると書く",
  "ページを最後の節まで描く",
  "もう使っていない Vercel を書かない",
  "アプリは Cloudflare で動くと書く",
  "Sentry にはエラーだけを送り、入力した内容は送らないと書く",
  "消した後も復元用の履歴に残る期間は、Neon の Free の上限の 6 時間と書く",
  "もうしていない画面の操作の記録と性能の計測を書かない",
];

const readRepoFile = (file: string) =>
  readFileSync(path.join(REPO_ROOT, file), "utf8");

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

type Manifest = {
  readonly dependencies: Readonly<Record<string, string>>;
  readonly devDependencies: Readonly<Record<string, string>>;
};

const manifest: Manifest = JSON.parse(readRepoFile("package.json"));
const lockfile = readRepoFile("bun.lock");

const pinnedVersionOf = (name: string) => ({
  name,
  declared: manifest.dependencies[name] ?? manifest.devDependencies[name],
  resolved: lockfile.match(
    new RegExp(`^ {4}"${name}": \\["${name}@([^"]+)"`, "m"),
  )?.[1],
});

const PartMessage = defineMessageUnion({ ClickedMenu: {} });
type PartMessage = typeof PartMessage.Type;
type PartModel = Readonly<{ menuClicks: number }>;

const countMenuClick = (current: PartModel, _message: PartMessage) => ({
  model: { menuClicks: current.menuClicks + 1 },
});

const viewOfParts =
  (parts: (h: HtmlBuilder<PartMessage>) => ReadonlyArray<Html>) =>
  (current: PartModel, h: HtmlBuilder<PartMessage>): Html =>
    h.div(
      [],
      [...parts(h), h.p([], [`メニューを押した回数 ${current.menuClicks}`])],
    );

describe("#677 公開ページが使う UI 部品", () => {
  it("AC-001 button の部品は「Taimei を試す」を、/auth を指す link として今の LP と同じ class で描く", async () => {
    const { buttonLinkView } = await import("../../shared/ui/button-view");
    const { SERVICE_NAME } = await import("../../shared/ui/brand-view");
    const { ArrowRight } = await import("lucide");
    const tryLink = role("link", { name: "Taimei を試す" });

    scene(
      {
        update: countMenuClick,
        view: viewOfParts((h) => [
          buttonLinkView(
            {
              label: `${SERVICE_NAME} を試す`,
              href: "/auth",
              look: "primaryHero",
              trailingIcon: ArrowRight,
            },
            h,
          ),
        ]),
      },
      given({ menuClicks: 0 }),
      expectInScene(tryLink).toHaveAttr("href", "/auth"),
      expectInScene(tryLink).toHaveAttr(
        "class",
        TRY_LINK_CLASS_OF_REACT_LANDING,
      ),
      expectInScene(selector("a svg")).toHaveAttr("class", "ml-2 h-5 w-5"),
    );
  });

  it("AC-002 button の部品は「詳細を見る」を、渡した行き先を指す link として今の LP と同じ class で描く", async () => {
    const { buttonLinkView } = await import("../../shared/ui/button-view");
    const detailLink = role("link", { name: "詳細を見る" });

    scene(
      {
        update: countMenuClick,
        view: viewOfParts((h) => [
          buttonLinkView(
            { label: "詳細を見る", href: "/service/1", look: "linkInCard" },
            h,
          ),
        ]),
      },
      given({ menuClicks: 0 }),
      expectInScene(detailLink).toHaveAttr("href", "/service/1"),
      expectInScene(detailLink).toHaveAttr(
        "class",
        DETAIL_LINK_CLASS_OF_REACT_LANDING,
      ),
    );
  });

  it("AC-003 button の部品はメニューの button を今の LP と同じ class で描き、押すと渡した Message が update に届く", async () => {
    const { buttonView } = await import("../../shared/ui/button-view");
    const { Menu } = await import("lucide");
    const menuButton = role("button", { name: "メニュー" });

    scene(
      {
        update: countMenuClick,
        view: viewOfParts((h) => [
          buttonView(
            {
              label: "メニュー",
              look: "ghostIconBelowMd",
              icon: Menu,
              onClick: PartMessage.ClickedMenu(),
            },
            h,
          ),
        ]),
      },
      given({ menuClicks: 0 }),
      expectInScene(menuButton).toHaveAttr(
        "class",
        MENU_BUTTON_CLASS_OF_REACT_LANDING,
      ),
      expectInScene(selector("button svg")).toHaveAttr("class", "h-5 w-5"),
      expectInScene(text("メニューを押した回数 0")).toExist(),
      click(menuButton),
      expectInScene(text("メニューを押した回数 1")).toExist(),
    );
  });

  it("AC-004 icon の部品は、lucide の icon の図形を今の LP の icon と同じ属性の svg で描く", async () => {
    const { iconView } = await import("../../shared/ui/icon-view");
    const { ArrowRight } = await import("lucide");
    const paths = all.selector("svg path");

    scene(
      {
        update: countMenuClick,
        view: viewOfParts((h) => [iconView(ArrowRight, [], h)]),
      },
      given({ menuClicks: 0 }),
      ...Object.entries(ICON_ATTRIBUTES_OF_REACT_LANDING).map(([name, value]) =>
        expectInScene(selector("svg")).toHaveAttr(name, value),
      ),
      expectAll(paths).toHaveCount(ARROW_RIGHT_PATHS_OF_REACT_LANDING.length),
      ...ARROW_RIGHT_PATHS_OF_REACT_LANDING.map((d, index) =>
        expectInScene(nth(paths, index)).toHaveAttr("d", d),
      ),
    );
  });

  it("AC-005 ロゴの部品は今の LP と同じ画像を描き、サービスの名前は Taimei", async () => {
    const { serviceLogoView, SERVICE_NAME } = await import(
      "../../shared/ui/brand-view"
    );
    const logo = altText("myservicelogo");

    scene(
      {
        update: countMenuClick,
        view: viewOfParts((h) => [serviceLogoView(h)]),
      },
      given({ menuClicks: 0 }),
      expectInScene(logo).toHaveAttr("src", "/icons/my-service-logo.png"),
      expectInScene(logo).toHaveAttr("class", "relative object-contain -z-10"),
      expectInScene(logo).toHaveStyle("width", "200px"),
      expectInScene(logo).toHaveStyle("height", "150px"),
    );
    expect(SERVICE_NAME).toBe("Taimei");
  });

  it("AC-006 部品・page・application public の code に、lucide-react と手書きの <svg が無い", () => {
    expect(
      gitGrepLines(
        "lucide-react|<svg",
        "web/src/shared/ui",
        "web/src/privacy/pages",
        "web/src/app/public",
      ),
    ).toEqual([]);
  });

  it("AC-007 lucide は 0.482.0 に固定され、@foldkit/ui を宣言する時は 0.170.0 に固定されている", () => {
    const foldkitUi = pinnedVersionOf("@foldkit/ui");

    expect(pinnedVersionOf("lucide")).toEqual({
      name: "lucide",
      declared: "0.482.0",
      resolved: "0.482.0",
    });
    expect(
      foldkitUi.declared === undefined
        ? "宣言していない"
        : `${foldkitUi.declared} / ${foldkitUi.resolved}`,
    ).toMatch(/^(宣言していない|0\.170\.0 \/ 0\.170\.0)$/);
  });

  it("AC-008 package.json に workspaces が無い", () => {
    expect(gitGrepLines('"workspaces"', "package.json")).toEqual([]);
  });
});

type PublicApplication = typeof import("../../app/public/main");
type PublicModel = ReturnType<PublicApplication["init"]>["model"];

const urlOf = (pathname: string) =>
  Option.getOrThrowWith(
    fromString(`https://app.example.com${pathname}`),
    () => new Error(`URL として読めない: ${pathname}`),
  );

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

const sceneTestSourcesUnder = (dir: string) =>
  readdirSync(path.join(REPO_ROOT, dir), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && /\.test\.tsx?$/.test(entry.name))
    .map((entry) =>
      readFileSync(path.join(entry.parentPath, entry.name), "utf8"),
    )
    .filter((source) => source.includes('"foldkit/scene"'));

describe("#678 プライバシーポリシーの page と application public", () => {
  it("AC-010 application public で /privacy を開くと、今のプライバシーポリシーと同じ文面が出る", async () => {
    const { init, update, view } = await import("../../app/public/main");

    scene(
      { update, view },
      given(init(urlOf("/privacy")).model),
      expectInScene(role("heading", { level: 1 })).toHaveText(PRIVACY_TITLE),
      expectAll(all.role("heading", { level: 2 })).toHaveCount(
        PRIVACY_SECTION_TITLES.length,
      ),
      ...PRIVACY_SECTION_TITLES.map((title) =>
        expectInScene(role("heading", { level: 2, name: title })).toExist(),
      ),
      expectAll(all.selector("p")).toHaveCount(PRIVACY_PARAGRAPHS.length),
      ...PRIVACY_PARAGRAPHS.map((paragraph) =>
        expectInScene(text(paragraph)).toExist(),
      ),
      expectAll(all.role("listitem")).toHaveCount(
        PRIVACY_STORAGE_LOCATIONS.length,
      ),
      ...PRIVACY_STORAGE_LOCATIONS.map((location, index) =>
        expectInScene(nth(all.role("listitem"), index)).toHaveText(location),
      ),
    );
  });

  it("AC-011 application public で /privacy を開くと、title がプライバシーポリシーになる", async () => {
    const application = await import("../../app/public/main");

    expect(
      titleOf(application, application.init(urlOf("/privacy")).model),
    ).toBe(PRIVACY_TITLE);
  });

  it("AC-012 application public をほかの path で開いた後、URL が /privacy に変わると title がプライバシーポリシーになる", async () => {
    const application = await import("../../app/public/main");
    const afterUrlChange: PublicModel[] = [];

    story(
      application.update,
      givenInStory(application.init(urlOf("/")).model),
      message(application.Message.ChangedUrl({ url: urlOf("/privacy") })),
      model((next) => {
        afterUrlChange.push(next);
      }),
    );

    expect(afterUrlChange.map((next) => titleOf(application, next))).toEqual([
      PRIVACY_TITLE,
    ]);
  });

  it("AC-013 application public を /privacy でない path で開くと、プライバシーポリシーの見出しは出ず、title は Taimei", async () => {
    const application = await import("../../app/public/main");
    const opened = application.init(urlOf("/no-such-page")).model;

    scene(
      { update: application.update, view: application.view },
      given(opened),
      expectInScene(role("heading", { name: PRIVACY_TITLE })).toBeAbsent(),
    );
    expect(titleOf(application, opened)).toBe("Taimei");
  });

  it("AC-014 application public と page の code に、契約と API の client が無い", () => {
    expect(
      gitGrepLines(
        "spa-contract|api-internal|@/api|HttpApiClient",
        "web/src/app/public",
        "web/src/privacy/pages",
      ),
    ).toEqual([]);
  });

  it("AC-015 web/src/privacy の下に、今の文面の試験の 7 つの試験名を持つ Scene の試験がある", () => {
    const sceneTests = sceneTestSourcesUnder(PRIVACY_DIR).join("\n");

    expect(
      REACT_PRIVACY_TEST_NAMES.filter((name) => !sceneTests.includes(name)),
    ).toEqual([]);
  });

  it("AC-016 React の文面の試験は、今の 7 つの試験名を持ったまま残る", () => {
    const reactTest = readRepoFile(REACT_PRIVACY_TEST);

    expect({
      rendersWithReact: reactTest.includes("react-dom/server"),
      missingNames: REACT_PRIVACY_TEST_NAMES.filter(
        (name) => !reactTest.includes(name),
      ),
    }).toEqual({ rendersWithReact: true, missingNames: [] });
  });
});
