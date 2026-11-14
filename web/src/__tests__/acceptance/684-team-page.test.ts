import { spawnSync } from "node:child_process";
import path from "node:path";
import { type Effect, ManagedRuntime, Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";
import { UrlRequest } from "foldkit/navigation";
import {
  all,
  change,
  click,
  expectAll,
  expect as expectInScene,
  given,
  label,
  nth,
  role,
  scene,
  selector,
  submit,
} from "foldkit/scene";
import { fromString } from "foldkit/url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SESSION_HEADER } from "../../../../src/spa-contract";
import { SpaHttpClient } from "../../shared/spa-http-client";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");
const ORIGIN = "https://app.example.com";

const TEAM_A_ID = "00000000-0000-4000-8000-0000000000aa";
const TEAM_B_ID = "00000000-0000-4000-8000-0000000000bb";

const ME_PATH = "/api/me";
const TEAMS_PATH = "/api/teams";
const teamPathOf = (teamId: string) => `/api/teams/${teamId}`;
const savePathOf = (teamId: string) => `/api/teams/${teamId}/my-levels`;
const TEAM_A_PATH = teamPathOf(TEAM_A_ID);
const TEAM_B_PATH = teamPathOf(TEAM_B_ID);
const SAVE_A_PATH = savePathOf(TEAM_A_ID);

const TEAMS_ROUTE = "/dashboard/teams";
const routeOf = (teamId: string) => `/dashboard/teams/${teamId}`;
const TEAM_A_ROUTE = routeOf(TEAM_A_ID);
const TEAM_B_ROUTE = routeOf(TEAM_B_ID);

const ME = { userId: "u_1", name: "山田 花子", canManage: false };
const COLLEAGUE = { userId: "u_3", name: "鈴木 一郎" };
const UNASSIGNED = { userId: "u_4", name: "田中 三郎" };

const DESIGN = { id: "00000000-0000-4000-8000-000000000a01", name: "設計" };
const BUILD = { id: "00000000-0000-4000-8000-000000000a02", name: "実装" };
const TESTING = { id: "00000000-0000-4000-8000-000000000a03", name: "テスト" };

const TEAM_A_PAGE = {
  team: {
    id: TEAM_A_ID,
    name: "開発",
    skills: [DESIGN, BUILD, TESTING],
    assignedUserIds: [COLLEAGUE.userId, ME.userId],
    levels: [
      { userId: ME.userId, skillId: DESIGN.id, level: 2, wantsToLearn: false },
      {
        userId: COLLEAGUE.userId,
        skillId: DESIGN.id,
        level: 3,
        wantsToLearn: true,
      },
      {
        userId: COLLEAGUE.userId,
        skillId: BUILD.id,
        level: 1,
        wantsToLearn: false,
      },
    ],
  },
  members: [{ userId: ME.userId, name: ME.name }, COLLEAGUE, UNASSIGNED],
};

const TEAM_B_PAGE = {
  team: {
    id: TEAM_B_ID,
    name: "営業",
    skills: [{ id: "00000000-0000-4000-8000-000000000b01", name: "接客" }],
    assignedUserIds: [ME.userId],
    levels: [],
  },
  members: [{ userId: ME.userId, name: ME.name }],
};

const withTeam = (
  page: typeof TEAM_A_PAGE,
  team: Partial<typeof TEAM_A_PAGE.team>,
  members: typeof TEAM_A_PAGE.members | null = page.members,
) => ({ team: { ...page.team, ...team }, members });

const SAVED = {};
const UNAUTHENTICATED = { _tag: "Unauthenticated" };
const NOT_ASSIGNED = { _tag: "NotAssigned" };
const TEAM_NOT_FOUND = { _tag: "TeamNotFound", teamId: TEAM_A_ID };

const BACK_LINK_CLASS_OF_REACT =
  "inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground";
const LEVEL_SELECT_CLASS_OF_REACT =
  "rounded-md border-input font-symbol text-sm";

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
  const pathsGivenTo = (historyCall: ReturnType<typeof vi.fn>) =>
    historyCall.mock.calls.map(
      ([, , url]) => new URL(String(url), ORIGIN).pathname,
    );
  return {
    location,
    pathsLeftFor: () =>
      location.assign.mock.calls.map(
        ([href]) => new URL(String(href), ORIGIN).pathname,
      ),
    pushedPaths: () => pathsGivenTo(history.pushState),
    replacedPaths: () => pathsGivenTo(history.replaceState),
  };
};

type SentRequest = Readonly<{ method: string; path: string; body: unknown }>;

const bodyOf = (body: RequestInit["body"]): unknown => {
  if (typeof body === "string") {
    return JSON.parse(body);
  }
  if (body instanceof Uint8Array) {
    return JSON.parse(new TextDecoder().decode(body));
  }
  return undefined;
};

const stubApi = (me: typeof ME) => {
  const sent: SentRequest[] = [];
  const replies = new Map<string, () => Response>();
  const holding = new Set<string>();
  const heldByRequest = new Map<string, PromiseWithResolvers<Response>[]>();
  const replyTo = (
    method: string,
    apiPath: string,
    body: unknown,
    init?: ResponseInit,
  ) => {
    holding.delete(`${method} ${apiPath}`);
    replies.set(`${method} ${apiPath}`, () => Response.json(body, init));
  };
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const apiPath = new URL(input instanceof Request ? input.url : input)
      .pathname;
    const method = init?.method ?? "GET";
    const request = `${method} ${apiPath}`;
    sent.push({ method, path: apiPath, body: bodyOf(init?.body) });
    if (holding.has(request)) {
      const held = Promise.withResolvers<Response>();
      heldByRequest.set(request, [...(heldByRequest.get(request) ?? []), held]);
      return held.promise;
    }
    const reply = replies.get(request);
    return reply === undefined
      ? Promise.reject(new Error(`応答を決めていない要求: ${request}`))
      : Promise.resolve(reply());
  });
  replyTo("GET", ME_PATH, me);
  const sentOf = (method: string, apiPath: string) =>
    sent.filter(
      (request) => request.method === method && request.path === apiPath,
    );
  return {
    replyTo,
    hold: (method: string, apiPath: string) => {
      holding.add(`${method} ${apiPath}`);
    },
    release: (
      method: string,
      apiPath: string,
      order: number,
      body: unknown,
      init?: ResponseInit,
    ) => {
      const held = heldByRequest.get(`${method} ${apiPath}`)?.[order];
      if (held === undefined) {
        throw new Error(
          `止めた要求が無い: ${method} ${apiPath} の ${order} 番目`,
        );
      }
      held.resolve(Response.json(body, init));
    },
    getCountOf: (apiPath: string) => sentOf("GET", apiPath).length,
    saves: (apiPath: string) => sentOf("PUT", apiPath).map(({ body }) => body),
  };
};

type Api = ReturnType<typeof stubApi>;

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
  const browser = stubBrowser(pathname);
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
    browser,
    enter: (nextPathname: string) =>
      driven.dispatch(
        application.Message.ChangedUrl({ url: urlOf(nextPathname) }),
      ),
    clickInternalLink: (nextPathname: string) =>
      driven.dispatch(
        application.Message.ClickedLink({
          request: UrlRequest.Internal({ url: urlOf(nextPathname) }),
        }),
      ),
    shows: (...expectations: ReadonlyArray<SceneStep>) => {
      scene(
        { update: modelOnly, view: drawn },
        given(driven.model()),
        ...expectations,
      );
    },
    does: (...interactions: ReadonlyArray<SceneStep>) => {
      const dispatched: Message[] = [];
      scene(
        {
          update: (shown: Model, message: Message) => {
            dispatched.push(message);
            return modelOnly(shown, message);
          },
          view: drawn,
        },
        given(driven.model()),
        ...interactions,
      );
      for (const message of dispatched) {
        driven.dispatch(message);
      }
    },
    title: () => {
      const titles: string[] = [];
      scene(
        {
          update: modelOnly,
          view: (shown: Model, h: HtmlBuilder<Message>) => {
            const document = drawn(shown, h);
            titles.push(document.title);
            return document;
          },
        },
        given(driven.model()),
      );
      return titles.at(-1);
    },
  };
};

type Dashboard = Awaited<ReturnType<typeof startDashboard>>;

const pageHeading = role("heading", { level: 1 });
const backLink = selector(`main a[href="${TEAMS_ROUTE}"]`);
const matrixHeading = role("heading", { name: "星取表" });
const myLevelsHeading = role("heading", { name: "自分のレベル" });
const saveButton = role("button", { name: "保存" });
const myLevelsForm = selector("form");
const levelSelectOf = (skillName: string) => label(`${skillName} のレベル`);
const wantsToLearnOf = (skillName: string) => label(`${skillName} を学びたい`);
const optionsOf = (skillName: string) =>
  all.selector(`select[aria-label="${skillName} のレベル"] option`);
const tables = all.selector("table");
const hasClassesOfReact = (
  target: Parameters<typeof expectInScene>[0],
  classNames: string,
) =>
  classNames
    .split(" ")
    .map((className) => expectInScene(target).toHaveClass(className));
const columnHeaders = all.selector("thead th");
const rowHeaders = all.selector("tbody th");
const rowOf = (index: number) => nth(all.selector("tbody tr"), index);
const myRow = rowOf(0);
const footRowOf = (index: number) => nth(all.selector("tfoot tr"), index);
const SKILL_COUNT = TEAM_A_PAGE.team.skills.length;
const footCellOf = (row: number, column: number) =>
  nth(all.selector("tfoot td"), row * SKILL_COUNT + column);
const alerts = all.role("alert");

const openTeam = async (
  api: Api,
  teamId: string = TEAM_A_ID,
  page: unknown = TEAM_A_PAGE,
) => {
  api.replyTo("GET", teamPathOf(teamId), page);
  const dashboard = await startDashboard(routeOf(teamId));
  await dashboard.idle();
  return dashboard;
};

const fillAndSave = (dashboard: Dashboard) =>
  dashboard.does(
    change(levelSelectOf(DESIGN.name), "3"),
    click(wantsToLearnOf(BUILD.name)),
    submit(myLevelsForm),
  );

const SAVED_ENTRIES = [
  { skillId: DESIGN.id, level: 3, wantsToLearn: false },
  { skillId: BUILD.id, level: 0, wantsToLearn: true },
];

const moveToTeamB = async (api: Api, dashboard: Dashboard) => {
  api.replyTo("GET", TEAM_B_PATH, TEAM_B_PAGE);
  dashboard.enter(TEAM_B_ROUTE);
  await vi.waitFor(() => expect(api.getCountOf(TEAM_B_PATH)).toBe(1));
  await vi.waitFor(() =>
    dashboard.shows(expectInScene(pageHeading).toHaveText("営業")),
  );
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

describe("チームの page の表示", () => {
  it("AC-001 チームの応答が届くと、チームの名前の見出しと、一覧へ戻る「チーム」の link (今と同じ class、aria-hidden の icon) を描く", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);

    dashboard.shows(
      expectInScene(pageHeading).toHaveText("開発"),
      expectInScene(backLink).toHaveText("チーム"),
      ...hasClassesOfReact(backLink, BACK_LINK_CLASS_OF_REACT),
      expectInScene(selector(`main a[href="${TEAMS_ROUTE}"] svg`)).toHaveAttr(
        "aria-hidden",
        "true",
      ),
    );
  });

  it("AC-002 星取表の列の見出しはメンバーとスキルの名前 (スキルの順)、行の見出しは割り当てたメンバーの名前 (メンバー一覧の順) である", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);

    dashboard.shows(
      expectInScene(matrixHeading).toExist(),
      expectAll(tables).toHaveCount(1),
      expectAll(columnHeaders).toHaveCount(4),
      expectInScene(nth(columnHeaders, 0)).toHaveText("メンバー"),
      expectInScene(nth(columnHeaders, 1)).toHaveText(DESIGN.name),
      expectInScene(nth(columnHeaders, 2)).toHaveText(BUILD.name),
      expectInScene(nth(columnHeaders, 3)).toHaveText(TESTING.name),
      expectAll(rowHeaders).toHaveCount(2),
      expectInScene(nth(rowHeaders, 0)).toHaveText(ME.name),
      expectInScene(nth(rowHeaders, 1)).toHaveText(COLLEAGUE.name),
    );
  });

  it("AC-003 記入済みの cell は記号とレベルの名前、学びたいなら「学」と「、学びたい」、未記入は「—」と「未記入」を描く", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);

    dashboard.shows(
      expectInScene(myRow).toHaveText(`${ME.name}○一人でできる—未記入—未記入`),
      expectInScene(rowOf(1)).toHaveText(
        `${COLLEAGUE.name}◎学教えられる、学びたい△支援があればできる—未記入`,
      ),
    );
  });

  it("AC-004 偏りの行は、一人でできる以上が 1 人以下のスキルにだけ「偏り」を描き、学びたいの行は人数を描く", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);

    dashboard.shows(
      expectInScene(footRowOf(0)).toContainText("偏り"),
      expectInScene(footCellOf(0, 0)).toHaveText(""),
      expectInScene(footCellOf(0, 1)).toHaveText("偏り"),
      expectInScene(footCellOf(0, 2)).toHaveText("偏り"),
      expectInScene(footRowOf(1)).toContainText("学びたい"),
      expectInScene(footCellOf(1, 0)).toHaveText("1"),
      expectInScene(footCellOf(1, 1)).toHaveText("0"),
      expectInScene(footCellOf(1, 2)).toHaveText("0"),
    );
  });

  it("AC-005 表の下に、レベルを高い順に並べ、未記入・学びたい・偏りを添えた凡例を描く", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);

    dashboard.shows(
      expectInScene(selector("p.text-xs.text-muted-foreground")).toHaveText(
        "◎ 教えられる○ 一人でできる△ 支援があればできる空欄 未経験— 未記入学 学びたい偏り 一人でできる以上の人が 1 人以下",
      ),
    );
  });

  it("AC-006 メンバー一覧が取れないと、星取表の section に「メンバー一覧を取得できませんでした」を描き、表を描かない", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(
      api,
      TEAM_A_ID,
      withTeam(TEAM_A_PAGE, {}, null),
    );

    dashboard.shows(
      expectInScene(matrixHeading).toExist(),
      expectInScene(selector("main")).toContainText(
        "メンバー一覧を取得できませんでした",
      ),
      expectAll(tables).toHaveCount(0),
    );
  });

  it.each([
    ["スキルが無い", withTeam(TEAM_A_PAGE, { skills: [], levels: [] })],
    [
      "割り当てたメンバーが居ない",
      withTeam(TEAM_A_PAGE, { assignedUserIds: [], levels: [] }),
    ],
  ])(
    "AC-007 %s と、星取表の section に案内を描き、表を描かない",
    async (_, page) => {
      const api = stubApi(ME);
      const dashboard = await openTeam(api, TEAM_A_ID, page);

      dashboard.shows(
        expectInScene(matrixHeading).toExist(),
        expectInScene(selector("main")).toContainText(
          "下のスキルを足してメンバーを割り当てると、ここに星取表が出ます",
        ),
        expectAll(tables).toHaveCount(0),
      );
    },
  );

  it("AC-008 自分が割り当てられていなければ、自分のレベルの見出しも保存の button も描かない", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(
      api,
      TEAM_A_ID,
      withTeam(TEAM_A_PAGE, { assignedUserIds: [COLLEAGUE.userId] }),
    );

    dashboard.shows(
      expectInScene(matrixHeading).toExist(),
      expectInScene(myLevelsHeading).toBeAbsent(),
      expectInScene(saveButton).toBeAbsent(),
    );
  });

  it("AC-009 自分が割り当てられていれば、自分のレベルの見出しと説明、スキルごとの select と checkbox (保存した値)、submit の保存の button を描く", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);

    dashboard.shows(
      expectInScene(myLevelsHeading).toExist(),
      expectInScene(selector("main")).toContainText(
        "記入すると星取表の自分の行に出ます",
      ),
      expectInScene(levelSelectOf(DESIGN.name)).toHaveValue("2"),
      ...hasClassesOfReact(
        levelSelectOf(DESIGN.name),
        LEVEL_SELECT_CLASS_OF_REACT,
      ),
      expectInScene(levelSelectOf(BUILD.name)).toHaveValue(""),
      expectInScene(levelSelectOf(TESTING.name)).toHaveValue(""),
      expectInScene(wantsToLearnOf(DESIGN.name)).not.toBeChecked(),
      expectInScene(wantsToLearnOf(DESIGN.name)).toHaveAttr("type", "checkbox"),
      expectInScene(selector("label")).toContainText("学びたい"),
      expectInScene(saveButton).toHaveAttr("type", "submit"),
      expectInScene(saveButton).toBeEnabled(),
    );
  });

  it("AC-010 記入済みのスキルの選択肢は 4 つで、未記入のスキルは先頭に空の値の「—: 未記入」を持つ", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);

    dashboard.shows(
      expectAll(optionsOf(DESIGN.name)).toHaveCount(4),
      expectInScene(nth(optionsOf(DESIGN.name), 0)).toHaveText("空欄: 未経験"),
      expectInScene(nth(optionsOf(DESIGN.name), 1)).toHaveText(
        "△: 支援があればできる",
      ),
      expectInScene(nth(optionsOf(DESIGN.name), 2)).toHaveText(
        "○: 一人でできる",
      ),
      expectInScene(nth(optionsOf(DESIGN.name), 3)).toHaveText("◎: 教えられる"),
      expectAll(optionsOf(BUILD.name)).toHaveCount(5),
      expectInScene(nth(optionsOf(BUILD.name), 0)).toHaveText("—: 未記入"),
      expectInScene(nth(optionsOf(BUILD.name), 0)).toHaveAttr("value", ""),
      expectInScene(levelSelectOf(BUILD.name)).toHaveValue(""),
    );
  });

  it("AC-027 チームの取得が TeamNotFound で失敗すると、「チーム」の link と「チームが見つかりません」を描き、見出しを描かない", async () => {
    const api = stubApi(ME);
    api.replyTo("GET", TEAM_A_PATH, TEAM_NOT_FOUND, { status: 404 });
    const dashboard = await startDashboard(TEAM_A_ROUTE);
    await dashboard.idle();

    dashboard.shows(
      expectInScene(backLink).toHaveText("チーム"),
      expectInScene(selector("main")).toContainText("チームが見つかりません"),
      expectInScene(pageHeading).toBeAbsent(),
    );
  });
});

describe("自分のレベルの保存", () => {
  it("AC-011 記入して保存すると、保存を 1 回送り、記入済みのスキルは選んだレベル、学びたいだけのスキルはレベル 0 で、何も無いスキルは送らない", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);
    api.replyTo("PUT", SAVE_A_PATH, SAVED);

    fillAndSave(dashboard);
    await dashboard.idle();

    const saves = api.saves(SAVE_A_PATH);
    expect(saves).toHaveLength(1);
    expect(saves[0]).toEqual({ levels: expect.any(Array) });
    const { levels } = saves[0] as { levels: unknown[] };
    expect(levels).toHaveLength(2);
    expect(levels).toEqual(expect.arrayContaining(SAVED_ENTRIES));
  });

  it("AC-012 保存の応答を待つ間、星取表の自分の行は送った値を描き、保存の button は無効である", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);
    api.hold("PUT", SAVE_A_PATH);

    fillAndSave(dashboard);
    await vi.waitFor(() => expect(api.saves(SAVE_A_PATH)).toHaveLength(1));

    dashboard.shows(
      expectInScene(myRow).toContainText("◎"),
      expectInScene(myRow).toContainText("学"),
      expectInScene(myRow).not.toContainText("○"),
      expectInScene(saveButton).toBeDisabled(),
    );
    api.release("PUT", SAVE_A_PATH, 0, SAVED);
    await dashboard.idle();
  });

  it("AC-013 保存が成功すると、自分の行は送った値のまま、保存の button は有効に戻り、チームを取り直さない", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);
    api.replyTo("PUT", SAVE_A_PATH, SAVED);
    expect(api.getCountOf(TEAM_A_PATH)).toBe(1);

    fillAndSave(dashboard);
    await dashboard.idle();

    dashboard.shows(
      expectInScene(myRow).toContainText("◎"),
      expectInScene(myRow).toContainText("学"),
      expectInScene(saveButton).toBeEnabled(),
      expectAll(alerts).toHaveCount(0),
    );
    expect(api.getCountOf(TEAM_A_PATH)).toBe(1);
  });

  it("AC-014 保存の前に始まったチームの取得が進行中に保存が成功すると、チームの取得をもう 1 回送る", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);
    api.replyTo("GET", TEAMS_PATH, { teams: [] });
    dashboard.enter(TEAMS_ROUTE);
    await dashboard.idle();
    api.hold("GET", TEAM_A_PATH);
    dashboard.enter(TEAM_A_ROUTE);
    await vi.waitFor(() => expect(api.getCountOf(TEAM_A_PATH)).toBe(2));
    api.replyTo("PUT", SAVE_A_PATH, SAVED);

    fillAndSave(dashboard);
    await vi.waitFor(() => expect(api.getCountOf(TEAM_A_PATH)).toBe(3));
    api.release("GET", TEAM_A_PATH, 0, TEAM_A_PAGE);
    api.release("GET", TEAM_A_PATH, 1, TEAM_A_PAGE);
    await dashboard.idle();
  });

  it("AC-015 保存が NotAssigned で失敗すると、alert に今と同じ文言を描き、自分の行は前の値に戻り、select と checkbox は記入した値のままである", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);
    api.replyTo("PUT", SAVE_A_PATH, NOT_ASSIGNED, { status: 403 });

    fillAndSave(dashboard);
    await dashboard.idle();

    dashboard.shows(
      expectAll(alerts).toHaveCount(1),
      expectInScene(nth(alerts, 0)).toHaveText(
        "チームに割り当てられた人だけが記入できます",
      ),
      expectInScene(myRow).toContainText("○"),
      expectInScene(myRow).not.toContainText("◎"),
      expectInScene(myRow).not.toContainText("学"),
      expectInScene(levelSelectOf(DESIGN.name)).toHaveValue("3"),
      expectInScene(wantsToLearnOf(BUILD.name)).toBeChecked(),
      expectInScene(saveButton).toBeEnabled(),
    );
  });

  it("AC-016 保存が契約の外の失敗で終わると、alert に「保存できませんでした」を描く", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);
    api.replyTo("PUT", SAVE_A_PATH, {}, { status: 500 });

    fillAndSave(dashboard);
    await dashboard.idle();

    dashboard.shows(
      expectInScene(nth(alerts, 0)).toHaveText("保存できませんでした"),
    );
  });

  it("AC-017 保存の応答を待つ間にもう一度送信しても、保存の要求は 1 回のままである", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);
    api.hold("PUT", SAVE_A_PATH);
    fillAndSave(dashboard);
    await vi.waitFor(() => expect(api.saves(SAVE_A_PATH)).toHaveLength(1));

    dashboard.does(submit(myLevelsForm));
    api.release("PUT", SAVE_A_PATH, 0, SAVED);
    await dashboard.idle();

    expect(api.saves(SAVE_A_PATH)).toHaveLength(1);
  });

  it("AC-018 未記入のスキルに学びたいだけを付けて保存した後、学びたいを外して保存すると、2 回目はレベル 0・学びたい無しを送る", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);
    api.replyTo("PUT", SAVE_A_PATH, SAVED);
    dashboard.does(click(wantsToLearnOf(BUILD.name)), submit(myLevelsForm));
    await dashboard.idle();

    dashboard.does(click(wantsToLearnOf(BUILD.name)), submit(myLevelsForm));
    await dashboard.idle();

    const saves = api.saves(SAVE_A_PATH) as { levels: unknown[] }[];
    expect(saves).toHaveLength(2);
    expect(saves[0]?.levels).toContainEqual({
      skillId: BUILD.id,
      level: 0,
      wantsToLearn: true,
    });
    expect(saves[1]?.levels).toContainEqual({
      skillId: BUILD.id,
      level: 0,
      wantsToLearn: false,
    });
  });

  it("AC-025 保存の応答が 401 だと、今の path を callbackUrl にした /auth へ document ごと移る", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);
    api.replyTo("PUT", SAVE_A_PATH, UNAUTHENTICATED, { status: 401 });

    fillAndSave(dashboard);
    await dashboard.idle();

    expect(dashboard.browser.location.assign).toHaveBeenCalledWith(
      `/auth?callbackUrl=${encodeURIComponent(TEAM_A_ROUTE)}`,
    );
  });

  it("AC-026 保存の応答の session の印が最初の応答と違うと、document を読み直す", async () => {
    const api = stubApi(ME);
    const markedAs = (mark: string) => ({
      headers: { [SESSION_HEADER]: mark },
    });
    api.replyTo("GET", ME_PATH, ME, markedAs("company_a u_1"));
    api.replyTo("GET", TEAM_A_PATH, TEAM_A_PAGE, markedAs("company_a u_1"));
    const dashboard = await startDashboard(TEAM_A_ROUTE);
    await dashboard.idle();
    expect(dashboard.browser.location.reload).not.toHaveBeenCalled();
    api.replyTo("PUT", SAVE_A_PATH, SAVED, markedAs("company_b u_1"));

    fillAndSave(dashboard);
    await dashboard.idle();

    expect(dashboard.browser.location.reload).toHaveBeenCalledOnce();
  });
});

describe("チームを替えた時と、離れて戻った時", () => {
  it("AC-019 A の保存の応答を待つ間に B へ移ると、B の応答を待つ間も届いた後も A の見出しと星取表を描かず、B の保存の button は有効である", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);
    api.hold("PUT", SAVE_A_PATH);
    fillAndSave(dashboard);
    await vi.waitFor(() => expect(api.saves(SAVE_A_PATH)).toHaveLength(1));
    api.hold("GET", TEAM_B_PATH);

    dashboard.enter(TEAM_B_ROUTE);
    await vi.waitFor(() => expect(api.getCountOf(TEAM_B_PATH)).toBe(1));

    dashboard.shows(
      expectInScene(selector("main")).not.toContainText("開発"),
      expectInScene(selector("main")).not.toContainText(DESIGN.name),
      expectAll(tables).toHaveCount(0),
    );
    api.release("GET", TEAM_B_PATH, 0, TEAM_B_PAGE);
    await vi.waitFor(() =>
      dashboard.shows(expectInScene(pageHeading).toHaveText("営業")),
    );
    dashboard.shows(
      expectInScene(selector("main")).not.toContainText("開発"),
      expectInScene(selector("main")).not.toContainText(DESIGN.name),
      expectInScene(saveButton).toBeEnabled(),
      expectAll(alerts).toHaveCount(0),
    );
    api.release("PUT", SAVE_A_PATH, 0, SAVED);
    await dashboard.idle();
  });

  it("AC-020 A の保存が B の表示中に失敗しても、B に alert を描かない", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);
    api.hold("PUT", SAVE_A_PATH);
    fillAndSave(dashboard);
    await vi.waitFor(() => expect(api.saves(SAVE_A_PATH)).toHaveLength(1));
    await moveToTeamB(api, dashboard);

    api.release("PUT", SAVE_A_PATH, 0, NOT_ASSIGNED, { status: 403 });
    await dashboard.idle();

    dashboard.shows(
      expectInScene(pageHeading).toHaveText("営業"),
      expectAll(alerts).toHaveCount(0),
      expectInScene(saveButton).toBeEnabled(),
    );
  });

  it("AC-021 A の保存が B の表示中に成功すると、A に戻った時、取り直しの応答を待つ間も自分の行に保存した値を描く", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);
    api.hold("PUT", SAVE_A_PATH);
    fillAndSave(dashboard);
    await vi.waitFor(() => expect(api.saves(SAVE_A_PATH)).toHaveLength(1));
    await moveToTeamB(api, dashboard);
    api.release("PUT", SAVE_A_PATH, 0, SAVED);
    await dashboard.idle();
    api.hold("GET", TEAM_A_PATH);

    dashboard.enter(TEAM_A_ROUTE);
    await vi.waitFor(() => expect(api.getCountOf(TEAM_A_PATH)).toBe(2));

    dashboard.shows(
      expectInScene(pageHeading).toHaveText("開発"),
      expectInScene(myRow).toContainText("◎"),
      expectInScene(myRow).toContainText("学"),
    );
    api.release(
      "GET",
      TEAM_A_PATH,
      0,
      withTeam(TEAM_A_PAGE, {
        levels: [
          ...TEAM_A_PAGE.team.levels.filter(
            ({ userId }) => userId !== ME.userId,
          ),
          ...SAVED_ENTRIES.map((entry) => ({ ...entry, userId: ME.userId })),
        ],
      }),
    );
    await dashboard.idle();
  });

  it("AC-022 A の保存の応答を待つ間に離れて A に戻ると、保存の button は無効のままで、もう一度送信しても保存は 1 回のままである", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);
    api.hold("PUT", SAVE_A_PATH);
    fillAndSave(dashboard);
    await vi.waitFor(() => expect(api.saves(SAVE_A_PATH)).toHaveLength(1));
    await moveToTeamB(api, dashboard);

    dashboard.enter(TEAM_A_ROUTE);
    await vi.waitFor(() =>
      dashboard.shows(expectInScene(pageHeading).toHaveText("開発")),
    );
    dashboard.shows(expectInScene(saveButton).toBeDisabled());
    dashboard.does(submit(myLevelsForm));
    api.release("PUT", SAVE_A_PATH, 0, SAVED);
    await dashboard.idle();

    expect(api.saves(SAVE_A_PATH)).toHaveLength(1);
  });

  it("AC-023 A の保存の応答を待つ間に離れ、離れている間に保存が失敗すると、A に戻った時に自分の行は保存の前の値を描く", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);
    api.hold("PUT", SAVE_A_PATH);
    fillAndSave(dashboard);
    await vi.waitFor(() => expect(api.saves(SAVE_A_PATH)).toHaveLength(1));
    await moveToTeamB(api, dashboard);
    api.release("PUT", SAVE_A_PATH, 0, NOT_ASSIGNED, { status: 403 });
    await dashboard.idle();

    dashboard.enter(TEAM_A_ROUTE);
    await dashboard.idle();

    dashboard.shows(
      expectInScene(pageHeading).toHaveText("開発"),
      expectInScene(myRow).toContainText("○"),
      expectInScene(myRow).not.toContainText("◎"),
      expectInScene(myRow).not.toContainText("学"),
    );
  });

  it("AC-024 保存の失敗を見た後に別のチームへ移って戻ると、alert は無く、select と checkbox は保存した値である", async () => {
    const api = stubApi(ME);
    const dashboard = await openTeam(api);
    api.replyTo("PUT", SAVE_A_PATH, NOT_ASSIGNED, { status: 403 });
    fillAndSave(dashboard);
    await dashboard.idle();
    dashboard.shows(expectAll(alerts).toHaveCount(1));
    await moveToTeamB(api, dashboard);

    dashboard.enter(TEAM_A_ROUTE);
    await dashboard.idle();

    dashboard.shows(
      expectInScene(pageHeading).toHaveText("開発"),
      expectAll(alerts).toHaveCount(0),
      expectInScene(levelSelectOf(DESIGN.name)).toHaveValue("2"),
      expectInScene(wantsToLearnOf(BUILD.name)).not.toBeChecked(),
    );
  });
});

describe("試験", () => {
  it("AC-028 web/src/dashboard の下に、星取表を描く Scene の試験と、保存を扱う Story の試験が在る", () => {
    const sceneFiles = gitGrepFiles(
      'from "foldkit/scene"',
      "web/src/dashboard",
    );
    const storyFiles = gitGrepFiles(
      'from "foldkit/story"',
      "web/src/dashboard",
    );
    const matrixFiles = gitGrepFiles("星取表", "web/src/dashboard");
    const saveFiles = gitGrepFiles("保存", "web/src/dashboard");

    expect(sceneFiles.filter((file) => matrixFiles.includes(file))).not.toEqual(
      [],
    );
    expect(storyFiles.filter((file) => saveFiles.includes(file))).not.toEqual(
      [],
    );
  });
});
