import { spawnSync } from "node:child_process";
import path from "node:path";
import { type Effect, ManagedRuntime, Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";
import {
  all,
  expectAll,
  expect as expectInScene,
  given,
  nth,
  role,
  scene,
  selector,
  text,
} from "foldkit/scene";
import { fromString } from "foldkit/url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SpaHttpClient } from "../../shared/spa-http-client";
import { buttonVariants, cn } from "../../shared/ui/class-names";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");
const ORIGIN = "https://app.example.com";

const ME_PATH = "/api/me";
const TEAMS_PATH = "/api/teams";
const MEMBERS_PATH = "/api/members";

const TEAMS_ROUTE = "/dashboard/teams";
const MEMBERS_ROUTE = "/dashboard/members";

const ME = { userId: "u_1", name: "山田 花子", canManage: true };
const MEMBERS = {
  members: [
    { name: "山田 花子", email: "hanako@example.com", role: "OWNER" },
    { name: "佐藤 次郎", email: "jiro@example.com", role: "ADMIN" },
    { name: "鈴木 三郎", email: "saburo@example.com", role: "MEMBER" },
    { name: "田中 四郎", email: "shiro@example.com" },
  ],
};

const DESCRIPTION =
  "事業所に所属している人です。チームへの割り当てはチームの画面で行います";
const INVITE_LINK_NAME = /メンバーを招待.*\(新しいタブで開きます\)/;

const HEADING_CLASS_OF_REACT = "text-2xl font-semibold";
const CARD_CLASS_OF_REACT =
  "rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden";
const INVITE_LINK_CLASS_OF_REACT = cn(
  buttonVariants({ variant: "outline", size: "sm" }),
);
const TABLE_CLASS_OF_REACT = "w-full whitespace-nowrap text-sm";
const THEAD_CLASS_OF_REACT = "border-b text-left text-muted-foreground";
const TBODY_CLASS_OF_REACT = "divide-y";
const COLUMN_HEADER_CLASSES_OF_REACT = [
  "px-6 py-3 font-medium",
  "py-3 font-medium",
  "px-6 py-3 font-medium",
];
const CELL_CLASSES_OF_REACT = [
  "px-6 py-4 font-medium",
  "py-4 text-muted-foreground",
  "px-6 py-4",
];

const urlOf = (pathnameAndQuery: string) =>
  Option.getOrThrowWith(
    fromString(`${ORIGIN}${pathnameAndQuery}`),
    () => new Error(`URL として読めない: ${pathnameAndQuery}`),
  );

afterEach(() => {
  vi.unstubAllGlobals();
});

const stubBrowser = (pathname: string) => {
  const location = {
    href: `${ORIGIN}${pathname}`,
    origin: ORIGIN,
    pathname,
    search: "",
    assign: vi.fn(),
    reload: vi.fn(),
  };
  const history = { pushState: vi.fn(), replaceState: vi.fn() };
  const scrollTo = vi.fn();
  vi.stubGlobal("window", {
    location,
    history,
    scrollTo,
    dispatchEvent: vi.fn(),
  });
  vi.stubGlobal("location", location);
  vi.stubGlobal("history", history);
  vi.stubGlobal("scrollTo", scrollTo);
};

const stubApi = () => {
  const sent: string[] = [];
  const replies = new Map<string, () => Response>();
  const holding = new Set<string>();
  const held = new Map<string, PromiseWithResolvers<Response>[]>();
  const replyTo = (apiPath: string, body: unknown, init?: ResponseInit) => {
    holding.delete(apiPath);
    replies.set(apiPath, () => Response.json(body, init));
  };
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    const apiPath = new URL(input instanceof Request ? input.url : input)
      .pathname;
    sent.push(apiPath);
    if (holding.has(apiPath)) {
      const waiting = Promise.withResolvers<Response>();
      held.set(apiPath, [...(held.get(apiPath) ?? []), waiting]);
      return waiting.promise;
    }
    const reply = replies.get(apiPath);
    return reply === undefined
      ? Promise.reject(new Error(`応答を決めていない要求: ${apiPath}`))
      : Promise.resolve(reply());
  });
  replyTo(ME_PATH, ME);
  return {
    replyTo,
    hold: (apiPath: string) => {
      holding.add(apiPath);
    },
    release: (apiPath: string, order: number, body: unknown) => {
      const waiting = held.get(apiPath)?.[order];
      if (waiting === undefined) {
        throw new Error(`止めた要求が無い: ${apiPath} の ${order} 番目`);
      }
      waiting.resolve(Response.json(body));
    },
    getCountOf: (apiPath: string) =>
      sent.filter((sentPath) => sentPath === apiPath).length,
  };
};

type Step<Model, Message, Resources> = Readonly<{
  model: Model;
  commands?: ReadonlyArray<
    Readonly<{ effect: Effect.Effect<Message, never, Resources> }>
  >;
}>;

const drive = <Model, Message, Resources>(
  update: (model: Model, message: Message) => Step<Model, Message, Resources>,
  run: (effect: Effect.Effect<Message, never, Resources>) => Promise<Message>,
  opened: Step<Model, Message, Resources>,
) => {
  let current = opened.model;
  const running = new Set<Promise<void>>();
  const apply = (step: Step<Model, Message, Resources>) => {
    current = step.model;
    for (const command of step.commands ?? []) {
      const done = run(command.effect).then((message) => {
        apply(update(current, message));
      });
      running.add(done);
      void done.finally(() => running.delete(done));
    }
  };
  apply(opened);
  return {
    model: () => current,
    dispatch: (message: Message) => apply(update(current, message)),
    idle: async () => {
      while (running.size > 0) {
        await Promise.all(running);
      }
    },
  };
};

const startDashboard = async (pathname: string) => {
  stubBrowser(pathname);
  const application = await import("../../app/dashboard/main");
  type Model = ReturnType<typeof application.init>["model"];
  type Message = Parameters<typeof application.update>[1];
  type SceneStep = Parameters<typeof scene<Model, Message>>[1];
  const runtime = ManagedRuntime.make(SpaHttpClient.layer(ORIGIN));
  const driven = drive(
    application.update,
    (effect) => runtime.runPromise(effect),
    application.init(urlOf(pathname)),
  );
  const modelOnly = (shown: Model, message: Message) => ({
    model: application.update(shown, message).model,
  });
  const drawn = (shown: Model, h: HtmlBuilder<Message>) => {
    const document = application.view(shown, h);
    return { ...document, body: document.body ?? h.div([], []) };
  };
  return {
    ...driven,
    enter: (nextPathname: string) =>
      driven.dispatch(
        application.Message.ChangedUrl({ url: urlOf(nextPathname) }),
      ),
    shows: (...expectations: ReadonlyArray<SceneStep>) => {
      scene(
        { update: modelOnly, view: drawn },
        given(driven.model()),
        ...expectations,
      );
    },
  };
};

const membersHeading = role("heading", { level: 1, name: "メンバー" });
const inviteLink = role("link", { name: INVITE_LINK_NAME });
const navLink = (name: string) => role("link", { name });
const columnHeaders = all.role("columnheader");
const memberRows = all.selector("tbody tr");
const tables = all.role("table");
const loading = all.role("status");
const memberCells = all.selector("tbody td");
const COLUMNS = 3;
const cellOf = (row: number, column: number) =>
  nth(memberCells, (row - 1) * COLUMNS + (column - 1));

const openMembers = async (members: unknown = MEMBERS) => {
  const api = stubApi();
  api.replyTo(MEMBERS_PATH, members);
  const dashboard = await startDashboard(MEMBERS_ROUTE);
  await dashboard.idle();
  return { api, dashboard };
};

const gitGrepFiles = (pattern: string, ...pathspecs: readonly string[]) => {
  const result = spawnSync(
    "git",
    ["grep", "--untracked", "-l", "-E", pattern, "--", ...pathspecs],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git grep ${pattern}: ${result.stderr}`);
  }
  return result.stdout.split("\n").filter((line) => line !== "");
};

describe("メンバーの一覧", () => {
  it("AC-001 一覧の応答を待つ間、見出し・説明・招待の link と、読み込み中であることを伝える status を描く", async () => {
    const api = stubApi();
    api.hold(MEMBERS_PATH);

    const dashboard = await startDashboard(MEMBERS_ROUTE);
    await vi.waitFor(() => expect(api.getCountOf(MEMBERS_PATH)).toBe(1));
    await vi.waitFor(() =>
      dashboard.shows(expectInScene(navLink("設定")).toExist()),
    );

    dashboard.shows(
      expectInScene(membersHeading).toExist(),
      expectInScene(text(DESCRIPTION)).toExist(),
      expectInScene(inviteLink).toExist(),
      expectInScene(role("status")).toContainText("読み込み中"),
    );
    api.release(MEMBERS_PATH, 0, MEMBERS);
    await dashboard.idle();
  });

  it("AC-002 一覧の応答が届くと、列の見出しと、メンバーごとの名前・メールアドレス・役割の行を応答の順に描く", async () => {
    const { dashboard } = await openMembers();

    dashboard.shows(
      expectAll(columnHeaders).toHaveCount(3),
      expectInScene(nth(columnHeaders, 0)).toHaveText("名前"),
      expectInScene(nth(columnHeaders, 1)).toHaveText("メールアドレス"),
      expectInScene(nth(columnHeaders, 2)).toHaveText("役割"),
      expectAll(memberRows).toHaveCount(4),
      expectInScene(cellOf(1, 1)).toHaveText("山田 花子"),
      expectInScene(cellOf(1, 2)).toHaveText("hanako@example.com"),
      expectInScene(cellOf(1, 3)).toHaveText("オーナー"),
      expectInScene(cellOf(2, 1)).toHaveText("佐藤 次郎"),
      expectInScene(cellOf(2, 2)).toHaveText("jiro@example.com"),
      expectInScene(cellOf(3, 1)).toHaveText("鈴木 三郎"),
      expectInScene(cellOf(4, 2)).toHaveText("shiro@example.com"),
      expectAll(loading).toHaveCount(0),
    );
  });

  it.each([
    [1, "OWNER", "オーナー"],
    [2, "ADMIN", "管理者"],
    [3, "MEMBER", "メンバー"],
  ])("AC-003 %i 行目の役割 %s を「%s」と描く", async (row, _role, label) => {
    const { dashboard } = await openMembers();

    dashboard.shows(expectInScene(cellOf(row, 3)).toHaveText(label));
  });

  it("AC-004 役割の無いメンバーの行は、役割を「—」と描く", async () => {
    const { dashboard } = await openMembers();

    dashboard.shows(expectInScene(cellOf(4, 3)).toHaveText("—"));
  });

  it("AC-005 一覧が空だと、列の見出しの行だけの表を描き、案内の文言を足さない", async () => {
    const { dashboard } = await openMembers({ members: [] });

    dashboard.shows(
      expectAll(tables).toHaveCount(1),
      expectAll(columnHeaders).toHaveCount(3),
      expectAll(memberRows).toHaveCount(0),
      expectAll(all.selector("main p")).toHaveCount(1),
      expectInScene(selector("main p")).toHaveText(DESCRIPTION),
      expectAll(loading).toHaveCount(0),
    );
  });

  it("AC-006 一覧の取得が失敗すると、見出し・説明・招待の link と「メンバー一覧を取得できませんでした」を描き、表を描かない", async () => {
    const api = stubApi();
    api.replyTo(MEMBERS_PATH, {}, { status: 500 });

    const dashboard = await startDashboard(MEMBERS_ROUTE);
    await dashboard.idle();

    dashboard.shows(
      expectInScene(membersHeading).toExist(),
      expectInScene(text(DESCRIPTION)).toExist(),
      expectInScene(inviteLink).toExist(),
      expectInScene(text("メンバー一覧を取得できませんでした")).toExist(),
      expectAll(tables).toHaveCount(0),
    );
  });

  it("AC-007 招待の link は、名前に「(新しいタブで開きます)」を含み、/auth/account/members を新しいタブで開き、rel を持つ", async () => {
    const { dashboard } = await openMembers();

    dashboard.shows(
      expectInScene(inviteLink).toHaveAttr("href", "/auth/account/members"),
      expectInScene(inviteLink).toHaveAttr("target", "_blank"),
      expectInScene(inviteLink).toHaveAttr("rel", "noopener noreferrer"),
    );
  });

  it("AC-008 見出し・card・招待の link・表・列の見出し・行の cell は、今の React の画面と同じ class を持つ", async () => {
    const { dashboard } = await openMembers();

    dashboard.shows(
      expectInScene(membersHeading).toHaveAttr("class", HEADING_CLASS_OF_REACT),
      expectInScene(inviteLink).toHaveAttr("class", INVITE_LINK_CLASS_OF_REACT),
      expectInScene(selector("main table")).toHaveAttr(
        "class",
        TABLE_CLASS_OF_REACT,
      ),
      expectInScene(selector("div.bg-card")).toHaveAttr(
        "class",
        CARD_CLASS_OF_REACT,
      ),
      expectAll(all.selector("div.bg-card table")).toHaveCount(1),
      expectInScene(selector("thead")).toHaveAttr(
        "class",
        THEAD_CLASS_OF_REACT,
      ),
      expectInScene(selector("tbody")).toHaveAttr(
        "class",
        TBODY_CLASS_OF_REACT,
      ),
      ...COLUMN_HEADER_CLASSES_OF_REACT.map((className, index) =>
        expectInScene(nth(columnHeaders, index)).toHaveAttr("class", className),
      ),
      ...COLUMN_HEADER_CLASSES_OF_REACT.map((_, index) =>
        expectInScene(nth(columnHeaders, index)).toHaveAttr("scope", "col"),
      ),
      ...CELL_CLASSES_OF_REACT.map((className, index) =>
        expectInScene(cellOf(1, index + 1)).toHaveAttr("class", className),
      ),
    );
  });

  it("AC-009 一覧を描いた後に離れて戻ると、裏の取り直しの応答を待つ間、前の一覧の行を描き、読み込み中の status を描かない", async () => {
    const { api, dashboard } = await openMembers();
    api.replyTo(TEAMS_PATH, { teams: [] });
    dashboard.enter(TEAMS_ROUTE);
    await dashboard.idle();
    const membersGetsBefore = api.getCountOf(MEMBERS_PATH);
    api.hold(MEMBERS_PATH);

    dashboard.enter(MEMBERS_ROUTE);
    await vi.waitFor(() =>
      expect(api.getCountOf(MEMBERS_PATH)).toBe(membersGetsBefore + 1),
    );

    dashboard.shows(
      expectAll(memberRows).toHaveCount(4),
      expectInScene(cellOf(1, 1)).toHaveText("山田 花子"),
      expectAll(loading).toHaveCount(0),
    );
    api.release(MEMBERS_PATH, 0, MEMBERS);
    await dashboard.idle();
  });

  it("AC-010 一覧を描いている時、nav のメンバーの link は aria-current=page を持ち、チームの link は持たない", async () => {
    const { dashboard } = await openMembers();

    dashboard.shows(
      expectAll(memberRows).toHaveCount(4),
      expectInScene(navLink("メンバー")).toHaveAttr("aria-current", "page"),
      expectInScene(navLink("チーム")).not.toHaveAttr("aria-current"),
    );
  });
});

describe("試験", () => {
  it("AC-011 web/src/dashboard の下に招待の link を描く Scene の試験が在り、web/src の下の Story の試験が /dashboard/members を扱う", () => {
    const sceneFiles = gitGrepFiles(
      'from "foldkit/scene"',
      "web/src/dashboard",
    );
    const inviteFiles = gitGrepFiles("メンバーを招待", "web/src/dashboard");
    expect(sceneFiles.filter((file) => inviteFiles.includes(file))).not.toEqual(
      [],
    );

    const storyFiles = gitGrepFiles('from "foldkit/story"', "web/src");
    const membersRouteFiles = gitGrepFiles('"/dashboard/members"', "web/src");
    expect(
      storyFiles.filter((file) => membersRouteFiles.includes(file)),
    ).not.toEqual([]);
  });
});
