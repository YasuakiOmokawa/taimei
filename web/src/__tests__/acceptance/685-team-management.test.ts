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
  filter,
  first,
  given,
  label,
  nth,
  role,
  scene,
  submit,
  text,
  type as typeInto,
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
const TEAM_A_PATH = teamPathOf(TEAM_A_ID);
const TEAM_B_PATH = teamPathOf(TEAM_B_ID);
const SKILLS_A_PATH = `${TEAM_A_PATH}/skills`;
const skillPathOf = (skillId: string) => `/api/skills/${skillId}`;
const assignmentPathOf = (userId: string) =>
  `${TEAM_A_PATH}/assignments/${userId}`;
const SAVE_A_PATH = `${TEAM_A_PATH}/my-levels`;

const TEAMS_ROUTE = "/dashboard/teams";
const routeOf = (teamId: string) => `/dashboard/teams/${teamId}`;
const TEAM_A_ROUTE = routeOf(TEAM_A_ID);
const TEAM_B_ROUTE = routeOf(TEAM_B_ID);

const MANAGER = { userId: "u_1", name: "山田 花子", canManage: true };
const MEMBER = { ...MANAGER, canManage: false };
const COLLEAGUE = { userId: "u_3", name: "鈴木 一郎" };
const CANDIDATE = { userId: "u_4", name: "田中 三郎" };
const OTHER_CANDIDATE = { userId: "u_5", name: "佐藤 四郎" };
const DEPARTED_ID = "u_departed";

const DESIGN = { id: "00000000-0000-4000-8000-000000000a01", name: "設計" };
const BUILD = { id: "00000000-0000-4000-8000-000000000a02", name: "実装" };
const TESTING = { id: "00000000-0000-4000-8000-000000000a03", name: "テスト" };

const TEAM_A_PAGE = {
  team: {
    id: TEAM_A_ID,
    name: "開発",
    skills: [DESIGN, BUILD],
    assignedUserIds: [COLLEAGUE.userId, MANAGER.userId],
    levels: [
      {
        userId: MANAGER.userId,
        skillId: DESIGN.id,
        level: 2,
        wantsToLearn: false,
      },
    ],
  },
  members: [
    { userId: MANAGER.userId, name: MANAGER.name },
    COLLEAGUE,
    CANDIDATE,
    OTHER_CANDIDATE,
  ],
};

type TeamPage = typeof TEAM_A_PAGE;

const TEAM_B_PAGE: TeamPage = {
  team: {
    id: TEAM_B_ID,
    name: "営業",
    skills: [{ id: "00000000-0000-4000-8000-000000000b01", name: "接客" }],
    assignedUserIds: [MANAGER.userId],
    levels: [],
  },
  members: [{ userId: MANAGER.userId, name: MANAGER.name }],
};

const withTeam = (
  team: Partial<TeamPage["team"]>,
  members: TeamPage["members"] | null = TEAM_A_PAGE.members,
) => ({ team: { ...TEAM_A_PAGE.team, ...team }, members });

const DONE = {};
const UNAUTHENTICATED = { _tag: "Unauthenticated" };
const DUPLICATE_NAME = { _tag: "DuplicateName" };
const NOT_COMPANY_MEMBER = { _tag: "NotCompanyMember" };
const TEAM_NOT_FOUND = { _tag: "TeamNotFound", teamId: TEAM_A_ID };

const DESTRUCTIVE_CLASS_OF_REACT =
  "shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive";
const FIELD_CLASS_OF_REACT = "w-full max-w-xs rounded-md border-input text-sm";

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
  const answers: boolean[] = [];
  const confirm = vi.fn((_message: string) => answers.shift() ?? false);
  vi.stubGlobal("window", {
    location,
    history,
    scrollTo,
    confirm,
    dispatchEvent: vi.fn(),
  });
  vi.stubGlobal("confirm", confirm);
  vi.stubGlobal("location", location);
  vi.stubGlobal("history", history);
  vi.stubGlobal("scrollTo", scrollTo);
  const pathsGivenTo = (historyCall: ReturnType<typeof vi.fn>) =>
    historyCall.mock.calls.map(
      ([, , url]) => new URL(String(url), ORIGIN).pathname,
    );
  return {
    location,
    willAnswer: (...nextAnswers: ReadonlyArray<boolean>) => {
      answers.push(...nextAnswers);
    },
    confirmations: () => confirm.mock.calls.map(([message]) => message),
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

const stubApi = (me: typeof MANAGER) => {
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
    bodiesOf: (method: string, apiPath: string) =>
      sentOf(method, apiPath).map(({ body }) => body),
    countOf: (method: string, apiPath: string) =>
      sentOf(method, apiPath).length,
    writes: () => sent.filter((request) => request.method !== "GET"),
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
const sectionHeading = (name: string) => role("heading", { name, level: 2 });
const nameListItems = all.selector("ul.border-t li");
const nameListItem = (index: number) => nth(nameListItems, index);
const columnHeaders = all.selector("thead th");
const rowHeaders = all.selector("tbody th");
const alerts = all.role("alert");
const buttonNamed = (name: string | RegExp) => role("button", { name });
const allButtonsNamed = (name: string | RegExp) => all.role("button", { name });
const skillNameInput = label("スキル名");
const teamNameInput = label("チーム名");
const assigneeSelect = label("割り当てるメンバー");
const assigneeOptions = all.selector(
  'select[aria-label="割り当てるメンバー"] option',
);
const formWith = (field: ReturnType<typeof label>) =>
  first(filter(all.selector("form"), { has: field }));
const skillForm = formWith(skillNameInput);
const renameForm = formWith(teamNameInput);
const assignForm = formWith(assigneeSelect);
const addSkillButton = buttonNamed("スキルを足す");
const assignButton = buttonNamed("割り当てる");
const renameButton = buttonNamed("名前を変える");
const deleteTeamButton = buttonNamed("チームを削除");
const saveButton = buttonNamed("保存");
const removeSkillButton = (skillName: string) =>
  buttonNamed(`${skillName} を削除`);
const unassignButton = (name: string) => buttonNamed(`${name} を外す`);
const MANAGEMENT_BUTTON_NAMES: ReadonlyArray<string | RegExp> = [
  /を削除$/,
  /を外す$/,
  "スキルを足す",
  "割り当てる",
  "名前を変える",
  "チームを削除",
];
const myRow = nth(all.selector("tbody tr"), 0);

const hasClassesOfReact = (
  target: Parameters<typeof expectInScene>[0],
  classNames: string,
) =>
  classNames
    .split(" ")
    .map((className) => expectInScene(target).toHaveClass(className));

const removeSkillConfirmation = (skillName: string) =>
  `スキル「${skillName}」を削除します。このスキルに記入したレベルも消え、元に戻せません。`;
const unassignConfirmation = (name: string) =>
  `${name} をこのチームから外します。このチームに記入したレベルも消え、元に戻せません。`;
const deleteTeamConfirmation = (teamName: string) =>
  `「${teamName}」を削除します。スキル・割り当て・記入したレベルも消え、元に戻せません。`;

const openTeam = async (
  api: Api,
  page: unknown = TEAM_A_PAGE,
  teamId: string = TEAM_A_ID,
) => {
  api.replyTo("GET", teamPathOf(teamId), page);
  const dashboard = await startDashboard(routeOf(teamId));
  await dashboard.idle();
  return dashboard;
};

const openAsManager = (page: unknown = TEAM_A_PAGE) =>
  openTeam(stubApi(MANAGER), page);

const rename = (dashboard: Dashboard, name: string) =>
  dashboard.does(typeInto(teamNameInput, name), submit(renameForm));

const addSkill = (dashboard: Dashboard, name: string) =>
  dashboard.does(typeInto(skillNameInput, name), submit(skillForm));

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

describe("一覧の表示と、管理の部品の有無", () => {
  it("AC-001 管理者でないメンバーには、スキルの section にスキルの名前をスキルの順に、割り当てたメンバーの section に名前をメンバー一覧の順に描く", async () => {
    const api = stubApi(MEMBER);
    const dashboard = await openTeam(api);

    dashboard.shows(
      expectInScene(sectionHeading("スキル")).toExist(),
      expectInScene(text("星取表の列になります")).toExist(),
      expectInScene(sectionHeading("割り当てたメンバー")).toExist(),
      expectInScene(text("星取表の行になります")).toExist(),
      expectAll(nameListItems).toHaveCount(4),
      expectInScene(nameListItem(0)).toHaveText(DESIGN.name),
      expectInScene(nameListItem(1)).toHaveText(BUILD.name),
      expectInScene(nameListItem(2)).toHaveText(MANAGER.name),
      expectInScene(nameListItem(3)).toHaveText(COLLEAGUE.name),
    );
  });

  it("AC-002 管理者でないメンバーには、管理の入力・select・見出し・button を描かない", async () => {
    const api = stubApi(MEMBER);
    const dashboard = await openTeam(
      api,
      withTeam({
        assignedUserIds: [COLLEAGUE.userId, MANAGER.userId, DEPARTED_ID],
      }),
    );

    dashboard.shows(
      expectInScene(sectionHeading("スキル")).toExist(),
      expectInScene(text(DEPARTED_ID)).not.toExist(),
      expectInScene(skillNameInput).not.toExist(),
      expectInScene(teamNameInput).not.toExist(),
      expectInScene(assigneeSelect).not.toExist(),
      expectInScene(sectionHeading("チーム名")).not.toExist(),
      ...MANAGEMENT_BUTTON_NAMES.map((name) =>
        expectAll(allButtonsNamed(name)).toHaveCount(0),
      ),
    );
  });

  it.each([
    ["スキルが無い", { skills: [] }, "スキルがありません"],
    [
      "割り当てたメンバーが居ない",
      { assignedUserIds: [] },
      "割り当てたメンバーがいません",
    ],
  ])("AC-003 %s と、その旨を描く", async (_, team, message) => {
    const api = stubApi(MEMBER);
    const dashboard = await openTeam(api, withTeam(team));

    dashboard.shows(expectInScene(text(message)).toExist());
  });

  it("AC-004 管理者には、スキルの行ごとに「<名前> を削除」、割り当てたメンバーの行ごとに「<名前> を外す」の button を今と同じ class で描く", async () => {
    const dashboard = await openAsManager();

    dashboard.shows(
      expectAll(allButtonsNamed(/^.+ を削除$/)).toHaveCount(2),
      expectInScene(removeSkillButton(DESIGN.name)).toHaveText("削除"),
      expectInScene(removeSkillButton(BUILD.name)).toHaveText("削除"),
      expectAll(allButtonsNamed(/^.+ を外す$/)).toHaveCount(2),
      expectInScene(unassignButton(MANAGER.name)).toHaveText("外す"),
      expectInScene(unassignButton(COLLEAGUE.name)).toHaveText("外す"),
      ...hasClassesOfReact(
        removeSkillButton(DESIGN.name),
        DESTRUCTIVE_CLASS_OF_REACT,
      ),
      ...hasClassesOfReact(
        unassignButton(COLLEAGUE.name),
        DESTRUCTIVE_CLASS_OF_REACT,
      ),
    );
  });

  it("AC-005 管理者には、スキル名の入力と「スキルを足す」、チーム名の section の入力と「名前を変える」、削除の説明と「チームを削除」を描く", async () => {
    const dashboard = await openAsManager();

    dashboard.shows(
      expectInScene(skillNameInput).toHaveValue(""),
      expectInScene(skillNameInput).toHaveAttr("required"),
      ...hasClassesOfReact(skillNameInput, FIELD_CLASS_OF_REACT),
      expectInScene(addSkillButton).toHaveAttr("type", "submit"),
      expectInScene(sectionHeading("チーム名")).toExist(),
      expectInScene(teamNameInput).toHaveValue("開発"),
      expectInScene(teamNameInput).toHaveAttr("required"),
      ...hasClassesOfReact(teamNameInput, FIELD_CLASS_OF_REACT),
      expectInScene(renameButton).toHaveAttr("type", "submit"),
      expectInScene(
        text("チームを削除すると、スキル・割り当て・記入したレベルも消えます"),
      ).toExist(),
      expectInScene(deleteTeamButton).toExist(),
      ...hasClassesOfReact(deleteTeamButton, DESTRUCTIVE_CLASS_OF_REACT),
    );
  });

  it("AC-006 割り当てるメンバーの select は、割り当てていない人だけを空の選択肢なしで並べ、先頭を選んでいる", async () => {
    const dashboard = await openAsManager();

    dashboard.shows(
      ...hasClassesOfReact(assigneeSelect, FIELD_CLASS_OF_REACT),
      expectInScene(assignButton).toHaveAttr("type", "submit"),
      expectAll(assigneeOptions).toHaveCount(2),
      expectInScene(nth(assigneeOptions, 0)).toHaveText(CANDIDATE.name),
      expectInScene(nth(assigneeOptions, 0)).toHaveAttr(
        "value",
        CANDIDATE.userId,
      ),
      expectInScene(nth(assigneeOptions, 1)).toHaveText(OTHER_CANDIDATE.name),
      expectInScene(nth(assigneeOptions, 1)).toHaveAttr(
        "value",
        OTHER_CANDIDATE.userId,
      ),
      expectInScene(assigneeSelect).toHaveValue(CANDIDATE.userId),
    );
  });

  it("AC-007 割り当てていない事業所のメンバーが居なければ、select も「割り当てる」も描かない", async () => {
    const dashboard = await openAsManager(
      withTeam({}, [{ userId: MANAGER.userId, name: MANAGER.name }, COLLEAGUE]),
    );

    dashboard.shows(
      expectInScene(sectionHeading("割り当てたメンバー")).toExist(),
      expectInScene(unassignButton(COLLEAGUE.name)).toExist(),
      expectInScene(assigneeSelect).not.toExist(),
      expectInScene(assignButton).not.toExist(),
    );
  });

  it("AC-008 事業所にいない人の割り当ては、管理者にだけ見出しと id と「<id> を外す」を描き、無ければ見出しを描かない", async () => {
    const departed = withTeam({
      assignedUserIds: [COLLEAGUE.userId, MANAGER.userId, DEPARTED_ID],
    });
    const departedHeading = role("heading", {
      name: "事業所にいない人の割り当て",
    });
    const manager = await openAsManager(departed);

    manager.shows(
      expectInScene(departedHeading).toExist(),
      expectInScene(text(DEPARTED_ID)).toExist(),
      expectInScene(unassignButton(DEPARTED_ID)).toExist(),
    );

    const member = await openTeam(stubApi(MEMBER), departed);
    member.shows(
      expectInScene(departedHeading).not.toExist(),
      expectInScene(text(DEPARTED_ID)).not.toExist(),
    );

    const withoutDeparted = await openAsManager();
    withoutDeparted.shows(expectInScene(departedHeading).not.toExist());
  });

  it("AC-009 メンバー一覧が取れないと、その旨を 2 か所に描き、管理者にも select と「を外す」を描かない", async () => {
    const dashboard = await openAsManager(withTeam({}, null));

    dashboard.shows(
      expectAll(all.text("メンバー一覧を取得できませんでした")).toHaveCount(2),
      expectInScene(assigneeSelect).not.toExist(),
      expectAll(allButtonsNamed(/を外す$/)).toHaveCount(0),
    );
  });
});

describe("名前の変更", () => {
  it("AC-010 名前を変えると PATCH を 1 回送り、成功するとチームを取り直し、見出しと入力は応答の名前になる", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    api.replyTo("PATCH", TEAM_A_PATH, DONE);
    api.replyTo("GET", TEAM_A_PATH, withTeam({ name: "新しい名前" }));

    rename(dashboard, "  新しい名前  ");
    await dashboard.idle();

    expect(api.bodiesOf("PATCH", TEAM_A_PATH)).toEqual([
      { name: "  新しい名前  " },
    ]);
    expect(api.getCountOf(TEAM_A_PATH)).toBe(2);
    dashboard.shows(
      expectInScene(pageHeading).toHaveText("新しい名前"),
      expectInScene(teamNameInput).toHaveValue("新しい名前"),
    );
  });

  it("AC-011 名前の変更が成功して取り直しを待つ間、「名前を変える」は無効で、入力は記入した値である", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    api.replyTo("PATCH", TEAM_A_PATH, DONE);
    api.hold("GET", TEAM_A_PATH);

    rename(dashboard, "  新しい名前  ");
    await vi.waitFor(() => expect(api.getCountOf(TEAM_A_PATH)).toBe(2));

    dashboard.shows(
      expectInScene(renameButton).toBeDisabled(),
      expectInScene(teamNameInput).toHaveValue("  新しい名前  "),
    );
    api.release("GET", TEAM_A_PATH, 0, withTeam({ name: "新しい名前" }));
    await dashboard.idle();
  });

  it("AC-012 名前の変更が DuplicateName で失敗すると、alert を描き、見出しは前の名前、入力は記入した値のままである", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    api.replyTo("PATCH", TEAM_A_PATH, DUPLICATE_NAME, { status: 409 });

    rename(dashboard, "営業");
    await dashboard.idle();

    dashboard.shows(
      expectAll(alerts).toHaveCount(1),
      expectInScene(nth(alerts, 0)).toHaveText("同じ名前がすでにあります"),
      expectInScene(pageHeading).toHaveText("開発"),
      expectInScene(teamNameInput).toHaveValue("営業"),
    );
  });

  it("AC-013 名前の変更が契約の外の失敗で終わると、alert に「名前を変えられませんでした」を描く", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    api.replyTo("PATCH", TEAM_A_PATH, {}, { status: 500 });

    rename(dashboard, "営業");
    await dashboard.idle();

    dashboard.shows(
      expectInScene(nth(alerts, 0)).toHaveText("名前を変えられませんでした"),
    );
  });

  it("AC-014 名前を変えた後に一覧へ移ると、一覧の取り直しを待つ間、変える前の名前を描かない", async () => {
    const api = stubApi(MANAGER);
    api.replyTo("GET", TEAMS_PATH, {
      teams: [{ id: TEAM_A_ID, name: "開発" }],
    });
    api.replyTo("GET", TEAM_A_PATH, TEAM_A_PAGE);
    const dashboard = await startDashboard(TEAMS_ROUTE);
    await dashboard.idle();
    dashboard.enter(TEAM_A_ROUTE);
    await dashboard.idle();
    api.replyTo("PATCH", TEAM_A_PATH, DONE);
    api.replyTo("GET", TEAM_A_PATH, withTeam({ name: "新しい名前" }));
    rename(dashboard, "新しい名前");
    await dashboard.idle();
    api.hold("GET", TEAMS_PATH);

    dashboard.enter(TEAMS_ROUTE);
    await vi.waitFor(() => expect(api.getCountOf(TEAMS_PATH)).toBe(2));

    dashboard.shows(
      expectAll(all.selector(`main a[href="${TEAM_A_ROUTE}"]`)).toHaveCount(0),
    );
    api.release("GET", TEAMS_PATH, 0, {
      teams: [{ id: TEAM_A_ID, name: "新しい名前" }],
    });
    await dashboard.idle();
  });
});

describe("スキルの追加と削除", () => {
  it("AC-015 スキルを足すと POST を 1 回送り、成功すると入力は空になり、取り直すと一覧と星取表の列に出る", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    api.replyTo("POST", SKILLS_A_PATH, DONE);
    api.hold("GET", TEAM_A_PATH);

    addSkill(dashboard, TESTING.name);
    await vi.waitFor(() => expect(api.getCountOf(TEAM_A_PATH)).toBe(2));

    expect(api.bodiesOf("POST", SKILLS_A_PATH)).toEqual([
      { name: TESTING.name },
    ]);
    dashboard.shows(expectInScene(skillNameInput).toHaveValue(""));
    api.release(
      "GET",
      TEAM_A_PATH,
      0,
      withTeam({ skills: [DESIGN, BUILD, TESTING] }),
    );
    await dashboard.idle();
    dashboard.shows(
      expectInScene(nameListItem(2)).toContainText(TESTING.name),
      expectInScene(removeSkillButton(TESTING.name)).toExist(),
      expectInScene(nth(columnHeaders, 3)).toHaveText(TESTING.name),
    );
  });

  it("AC-016 スキルの追加が DuplicateName で失敗すると、alert を描き、入力は記入した値のままである", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    api.replyTo("POST", SKILLS_A_PATH, DUPLICATE_NAME, { status: 409 });

    addSkill(dashboard, DESIGN.name);
    await dashboard.idle();

    dashboard.shows(
      expectInScene(nth(alerts, 0)).toHaveText("同じ名前がすでにあります"),
      expectInScene(skillNameInput).toHaveValue(DESIGN.name),
    );
  });

  it("AC-017 「<スキル名> を削除」は確認を出し、取り消すと要求を送らず、一覧は変わらない", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    dashboard.browser.willAnswer(false);

    dashboard.does(click(removeSkillButton(DESIGN.name)));
    await dashboard.idle();

    expect(dashboard.browser.confirmations()).toEqual([
      removeSkillConfirmation(DESIGN.name),
    ]);
    expect(api.writes()).toEqual([]);
    dashboard.shows(
      expectInScene(removeSkillButton(DESIGN.name)).toBeEnabled(),
      expectAll(alerts).toHaveCount(0),
    );
  });

  it("AC-018 スキルの削除を確認すると DELETE を 1 回送り、成功して取り直すと一覧から消す", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    dashboard.browser.willAnswer(true);
    api.replyTo("DELETE", skillPathOf(DESIGN.id), DONE);
    api.replyTo("GET", TEAM_A_PATH, withTeam({ skills: [BUILD], levels: [] }));

    dashboard.does(click(removeSkillButton(DESIGN.name)));
    await dashboard.idle();

    expect(api.countOf("DELETE", skillPathOf(DESIGN.id))).toBe(1);
    expect(api.getCountOf(TEAM_A_PATH)).toBe(2);
    dashboard.shows(
      expectInScene(removeSkillButton(DESIGN.name)).not.toExist(),
      expectInScene(removeSkillButton(BUILD.name)).toExist(),
    );
  });

  it("AC-019 スキルの削除が契約の外の失敗で終わると、alert に「スキルを削除できませんでした」を描く", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    dashboard.browser.willAnswer(true);
    api.replyTo("DELETE", skillPathOf(DESIGN.id), {}, { status: 500 });

    dashboard.does(click(removeSkillButton(DESIGN.name)));
    await dashboard.idle();

    dashboard.shows(
      expectInScene(nth(alerts, 0)).toHaveText("スキルを削除できませんでした"),
    );
  });
});

describe("割り当てと外すこと", () => {
  it("AC-020 選んだ人を割り当てると PUT を 1 回送り、取り直すと一覧と星取表の行に出て、候補から消える", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    api.replyTo("PUT", assignmentPathOf(OTHER_CANDIDATE.userId), DONE);
    api.replyTo(
      "GET",
      TEAM_A_PATH,
      withTeam({
        assignedUserIds: [
          COLLEAGUE.userId,
          MANAGER.userId,
          OTHER_CANDIDATE.userId,
        ],
      }),
    );

    dashboard.does(
      change(assigneeSelect, OTHER_CANDIDATE.userId),
      submit(assignForm),
    );
    await dashboard.idle();

    expect(api.countOf("PUT", assignmentPathOf(OTHER_CANDIDATE.userId))).toBe(
      1,
    );
    dashboard.shows(
      expectInScene(unassignButton(OTHER_CANDIDATE.name)).toExist(),
      expectAll(rowHeaders).toHaveCount(3),
      expectInScene(nth(rowHeaders, 2)).toHaveText(OTHER_CANDIDATE.name),
      expectAll(assigneeOptions).toHaveCount(1),
      expectInScene(assigneeSelect).toHaveValue(CANDIDATE.userId),
    );
  });

  it("AC-020 選ばずに「割り当てる」を押すと、先頭の候補で送る", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    api.replyTo("PUT", assignmentPathOf(CANDIDATE.userId), DONE);

    dashboard.does(submit(assignForm));
    await dashboard.idle();

    expect(
      api.writes().map(({ method, path: apiPath }) => `${method} ${apiPath}`),
    ).toEqual([`PUT ${assignmentPathOf(CANDIDATE.userId)}`]);
  });

  it("AC-021 割り当てが NotCompanyMember で失敗すると、alert に「事業所のメンバーではありません」を描く", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    api.replyTo(
      "PUT",
      assignmentPathOf(CANDIDATE.userId),
      { ...NOT_COMPANY_MEMBER, userId: CANDIDATE.userId },
      { status: 422 },
    );

    dashboard.does(submit(assignForm));
    await dashboard.idle();

    dashboard.shows(
      expectInScene(nth(alerts, 0)).toHaveText(
        "事業所のメンバーではありません",
      ),
    );
  });

  it("AC-022 「<名前> を外す」は確認を出し、取り消すと送らず、確認すると DELETE を 1 回送り、取り直すと一覧から消す", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    dashboard.browser.willAnswer(false, true);
    api.replyTo("DELETE", assignmentPathOf(COLLEAGUE.userId), DONE);
    api.replyTo(
      "GET",
      TEAM_A_PATH,
      withTeam({ assignedUserIds: [MANAGER.userId] }),
    );

    dashboard.does(click(unassignButton(COLLEAGUE.name)));
    await dashboard.idle();

    expect(api.writes()).toEqual([]);

    dashboard.does(click(unassignButton(COLLEAGUE.name)));
    await dashboard.idle();

    expect(dashboard.browser.confirmations()).toEqual([
      unassignConfirmation(COLLEAGUE.name),
      unassignConfirmation(COLLEAGUE.name),
    ]);
    expect(api.countOf("DELETE", assignmentPathOf(COLLEAGUE.userId))).toBe(1);
    dashboard.shows(
      expectInScene(unassignButton(COLLEAGUE.name)).not.toExist(),
      expectInScene(unassignButton(MANAGER.name)).toExist(),
    );
  });

  it("AC-023 外すことが契約の外の失敗で終わると、alert に「外せませんでした」を描く", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    dashboard.browser.willAnswer(true);
    api.replyTo(
      "DELETE",
      assignmentPathOf(COLLEAGUE.userId),
      {},
      { status: 500 },
    );

    dashboard.does(click(unassignButton(COLLEAGUE.name)));
    await dashboard.idle();

    dashboard.shows(
      expectInScene(nth(alerts, 0)).toHaveText("外せませんでした"),
    );
  });
});

describe("チームの削除", () => {
  it("AC-024 「チームを削除」は確認を出し、取り消すと要求を送らず、見出しはそのままである", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    dashboard.browser.willAnswer(false);

    dashboard.does(click(deleteTeamButton));
    await dashboard.idle();

    expect(dashboard.browser.confirmations()).toEqual([
      deleteTeamConfirmation("開発"),
    ]);
    expect(api.writes()).toEqual([]);
    expect(dashboard.browser.pushedPaths()).toEqual([]);
    dashboard.shows(
      expectInScene(pageHeading).toHaveText("開発"),
      expectInScene(deleteTeamButton).toBeEnabled(),
    );
  });

  it("AC-025 削除を確認すると DELETE を 1 回送り、成功すると一覧へ history に積んで移り、取り直しを待つ間は消す前の一覧を描かない", async () => {
    const api = stubApi(MANAGER);
    api.replyTo("GET", TEAMS_PATH, {
      teams: [
        { id: TEAM_A_ID, name: "開発" },
        { id: TEAM_B_ID, name: "営業" },
      ],
    });
    api.replyTo("GET", TEAM_A_PATH, TEAM_A_PAGE);
    const dashboard = await startDashboard(TEAMS_ROUTE);
    await dashboard.idle();
    dashboard.enter(TEAM_A_ROUTE);
    await dashboard.idle();
    dashboard.browser.willAnswer(true);
    api.replyTo("DELETE", TEAM_A_PATH, DONE);

    dashboard.does(click(deleteTeamButton));
    await dashboard.idle();

    expect(api.countOf("DELETE", TEAM_A_PATH)).toBe(1);
    expect(dashboard.browser.pushedPaths()).toEqual([TEAMS_ROUTE]);
    api.hold("GET", TEAMS_PATH);
    dashboard.enter(TEAMS_ROUTE);
    await vi.waitFor(() => expect(api.getCountOf(TEAMS_PATH)).toBe(2));
    dashboard.shows(
      expectAll(all.selector(`main a[href="${TEAM_A_ROUTE}"]`)).toHaveCount(0),
      expectAll(all.selector(`main a[href="${TEAM_B_ROUTE}"]`)).toHaveCount(0),
    );
    api.release("GET", TEAMS_PATH, 0, {
      teams: [{ id: TEAM_B_ID, name: "営業" }],
    });
    await dashboard.idle();
    dashboard.shows(
      expectAll(all.selector(`main a[href="${TEAM_A_ROUTE}"]`)).toHaveCount(0),
      expectAll(all.selector(`main a[href="${TEAM_B_ROUTE}"]`)).toHaveCount(1),
    );
  });

  it("AC-026 削除した後にそのチームへ入ると取得を送り、TeamNotFound なら「チームが見つかりません」を描く", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    dashboard.browser.willAnswer(true);
    api.replyTo("DELETE", TEAM_A_PATH, DONE);
    api.replyTo("GET", TEAMS_PATH, { teams: [] });
    dashboard.does(click(deleteTeamButton));
    await dashboard.idle();
    dashboard.enter(TEAMS_ROUTE);
    await dashboard.idle();
    api.replyTo("GET", TEAM_A_PATH, TEAM_NOT_FOUND, { status: 404 });

    dashboard.enter(TEAM_A_ROUTE);
    await dashboard.idle();

    expect(api.getCountOf(TEAM_A_PATH)).toBe(2);
    dashboard.shows(
      expectInScene(text("チームが見つかりません")).toExist(),
      expectInScene(pageHeading).not.toExist(),
    );
  });

  it("AC-027 削除が契約の外の失敗で終わると alert を描き、もう一度押して確認を取り消しても alert は残り、要求は送らない", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    dashboard.browser.willAnswer(true, false);
    api.replyTo("DELETE", TEAM_A_PATH, {}, { status: 500 });
    dashboard.does(click(deleteTeamButton));
    await dashboard.idle();
    dashboard.shows(
      expectInScene(nth(alerts, 0)).toHaveText("チームを削除できませんでした"),
    );

    dashboard.does(click(deleteTeamButton));
    await dashboard.idle();

    expect(dashboard.browser.confirmations()).toHaveLength(2);
    expect(api.countOf("DELETE", TEAM_A_PATH)).toBe(1);
    dashboard.shows(
      expectAll(alerts).toHaveCount(1),
      expectInScene(nth(alerts, 0)).toHaveText("チームを削除できませんでした"),
      expectInScene(deleteTeamButton).toBeEnabled(),
    );
  });
});

describe("送信中と取り直しの間", () => {
  it.each([
    {
      form: "名前",
      method: "PATCH",
      apiPath: TEAM_A_PATH,
      button: renameButton,
      send: (dashboard: Dashboard) => rename(dashboard, "新しい名前"),
      resend: submit(renameForm),
    },
    {
      form: "スキル",
      method: "POST",
      apiPath: SKILLS_A_PATH,
      button: addSkillButton,
      send: (dashboard: Dashboard) => addSkill(dashboard, TESTING.name),
      resend: submit(skillForm),
    },
    {
      form: "割り当て",
      method: "PUT",
      apiPath: assignmentPathOf(CANDIDATE.userId),
      button: assignButton,
      send: (dashboard: Dashboard) => dashboard.does(submit(assignForm)),
      resend: submit(assignForm),
    },
  ])(
    "AC-028 $form の応答を待つ間にもう一度送信しても、要求は 1 回のままで、button は無効である",
    async ({ method, apiPath, button, send, resend }) => {
      const api = stubApi(MANAGER);
      const dashboard = await openTeam(api);
      api.hold(method, apiPath);
      send(dashboard);
      await vi.waitFor(() => expect(api.countOf(method, apiPath)).toBe(1));

      dashboard.does(resend);
      await Promise.resolve();

      expect(api.countOf(method, apiPath)).toBe(1);
      dashboard.shows(expectInScene(button).toBeDisabled());
      api.release(method, apiPath, 0, {}, { status: 500 });
      await dashboard.idle();
      expect(api.countOf(method, apiPath)).toBe(1);
    },
  );

  it.each([
    {
      operation: "スキルの削除",
      method: "DELETE",
      apiPath: skillPathOf(DESIGN.id),
      button: removeSkillButton(DESIGN.name),
    },
    {
      operation: "外すこと",
      method: "DELETE",
      apiPath: assignmentPathOf(COLLEAGUE.userId),
      button: unassignButton(COLLEAGUE.name),
    },
    {
      operation: "チームの削除",
      method: "DELETE",
      apiPath: TEAM_A_PATH,
      button: deleteTeamButton,
    },
  ])(
    "AC-029 $operation の応答を待つ間は同じ button が無効で押せず、確認も要求も 1 回のままである",
    async ({ method, apiPath, button }) => {
      const api = stubApi(MANAGER);
      const dashboard = await openTeam(api);
      dashboard.browser.willAnswer(true, true);
      api.hold(method, apiPath);
      dashboard.does(click(button));
      await vi.waitFor(() => expect(api.countOf(method, apiPath)).toBe(1));

      dashboard.shows(expectInScene(button).toBeDisabled());
      expect(() => dashboard.does(click(button))).toThrow(/disabled/);

      expect(dashboard.browser.confirmations()).toHaveLength(1);
      expect(api.countOf(method, apiPath)).toBe(1);
      api.release(method, apiPath, 0, {}, { status: 500 });
      await dashboard.idle();
      expect(api.countOf(method, apiPath)).toBe(1);
    },
  );

  it("AC-030 管理の更新が成功して取り直しを待つ間、管理の button は無効で、form を送信しても要求を送らず、届くと有効に戻る", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    api.replyTo("POST", SKILLS_A_PATH, DONE);
    api.hold("GET", TEAM_A_PATH);
    addSkill(dashboard, TESTING.name);
    await vi.waitFor(() => expect(api.getCountOf(TEAM_A_PATH)).toBe(2));
    const managementButtons = [
      removeSkillButton(DESIGN.name),
      unassignButton(COLLEAGUE.name),
      addSkillButton,
      assignButton,
      renameButton,
      deleteTeamButton,
    ];

    dashboard.shows(
      ...managementButtons.map((button) =>
        expectInScene(button).toBeDisabled(),
      ),
    );
    dashboard.does(
      typeInto(skillNameInput, TESTING.name),
      submit(skillForm),
      submit(assignForm),
      typeInto(teamNameInput, "新しい名前"),
      submit(renameForm),
    );
    await Promise.resolve();
    expect(api.writes()).toHaveLength(1);

    api.release(
      "GET",
      TEAM_A_PATH,
      0,
      withTeam({ skills: [DESIGN, BUILD, TESTING] }),
    );
    await dashboard.idle();
    expect(api.writes()).toHaveLength(1);
    dashboard.shows(
      ...managementButtons.map((button) => expectInScene(button).toBeEnabled()),
    );
  });

  it("AC-031 スキルの追加の応答を待つ間も、「名前を変える」「割り当てる」「保存」は有効である", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    api.hold("POST", SKILLS_A_PATH);

    addSkill(dashboard, TESTING.name);
    await vi.waitFor(() => expect(api.countOf("POST", SKILLS_A_PATH)).toBe(1));

    dashboard.shows(
      expectInScene(addSkillButton).toBeDisabled(),
      expectInScene(renameButton).toBeEnabled(),
      expectInScene(assignButton).toBeEnabled(),
      expectInScene(saveButton).toBeEnabled(),
    );
    api.release("POST", SKILLS_A_PATH, 0, {}, { status: 500 });
    await dashboard.idle();
  });

  it("AC-032 保存が失敗した後、スキルの追加の応答を待つ間、星取表の自分の行は保存の前の値を描く", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    api.replyTo("PUT", SAVE_A_PATH, {}, { status: 500 });
    dashboard.does(
      change(label(`${DESIGN.name} のレベル`), "3"),
      submit(formWith(label(`${DESIGN.name} のレベル`))),
    );
    await dashboard.idle();
    api.hold("POST", SKILLS_A_PATH);

    addSkill(dashboard, TESTING.name);
    await vi.waitFor(() => expect(api.countOf("POST", SKILLS_A_PATH)).toBe(1));

    dashboard.shows(
      expectInScene(nth(rowHeaders, 0)).toHaveText(MANAGER.name),
      expectInScene(myRow).toContainText("○"),
      expectInScene(myRow).not.toContainText("◎"),
    );
    api.release("POST", SKILLS_A_PATH, 0, {}, { status: 500 });
    await dashboard.idle();
  });

  it("AC-033 A の名前の変更の応答を待つ間に B へ移って A に戻ると、「名前を変える」は無効のままで、もう一度送っても 1 回のままである", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    api.hold("PATCH", TEAM_A_PATH);
    rename(dashboard, "新しい名前");
    await vi.waitFor(() => expect(api.countOf("PATCH", TEAM_A_PATH)).toBe(1));
    api.replyTo("GET", TEAM_B_PATH, TEAM_B_PAGE);
    dashboard.enter(TEAM_B_ROUTE);
    await vi.waitFor(() => expect(api.getCountOf(TEAM_B_PATH)).toBe(1));
    await vi.waitFor(() =>
      dashboard.shows(expectInScene(pageHeading).toHaveText("営業")),
    );

    dashboard.enter(TEAM_A_ROUTE);
    await vi.waitFor(() => expect(api.getCountOf(TEAM_A_PATH)).toBe(2));
    await vi.waitFor(() =>
      dashboard.shows(expectInScene(pageHeading).toHaveText("開発")),
    );

    dashboard.shows(expectInScene(renameButton).toBeDisabled());
    dashboard.does(submit(renameForm));
    await Promise.resolve();
    expect(api.countOf("PATCH", TEAM_A_PATH)).toBe(1);
    api.release("PATCH", TEAM_A_PATH, 0, {}, { status: 500 });
    await dashboard.idle();
    expect(api.countOf("PATCH", TEAM_A_PATH)).toBe(1);
  });

  it("AC-034 A のスキルの追加の応答を待つ間に B へ移ると、B の「スキルを足す」は有効で、B のスキル名の入力は空である", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    api.hold("POST", SKILLS_A_PATH);
    addSkill(dashboard, TESTING.name);
    await vi.waitFor(() => expect(api.countOf("POST", SKILLS_A_PATH)).toBe(1));
    api.replyTo("GET", TEAM_B_PATH, TEAM_B_PAGE);

    dashboard.enter(TEAM_B_ROUTE);
    await vi.waitFor(() =>
      dashboard.shows(expectInScene(pageHeading).toHaveText("営業")),
    );

    dashboard.shows(
      expectInScene(addSkillButton).toBeEnabled(),
      expectInScene(skillNameInput).toHaveValue(""),
    );
    api.release("POST", SKILLS_A_PATH, 0, {}, { status: 500 });
    await dashboard.idle();
  });

  it("AC-035 管理の更新の応答が 401 だと /auth へ document ごと移り、session の印が違うと document を読み直す", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeam(api);
    api.replyTo("POST", SKILLS_A_PATH, UNAUTHENTICATED, { status: 401 });

    addSkill(dashboard, TESTING.name);
    await dashboard.idle();

    expect(dashboard.browser.location.assign).toHaveBeenCalledWith(
      `/auth?callbackUrl=${encodeURIComponent(TEAM_A_ROUTE)}`,
    );

    const markedApi = stubApi(MANAGER);
    const markedAs = (mark: string) => ({
      headers: { [SESSION_HEADER]: mark },
    });
    markedApi.replyTo("GET", ME_PATH, MANAGER, markedAs("company_a u_1"));
    markedApi.replyTo(
      "GET",
      TEAM_A_PATH,
      TEAM_A_PAGE,
      markedAs("company_a u_1"),
    );
    const marked = await startDashboard(TEAM_A_ROUTE);
    await marked.idle();
    markedApi.replyTo("PATCH", TEAM_A_PATH, DONE, markedAs("company_b u_1"));

    rename(marked, "新しい名前");
    await marked.idle();

    expect(marked.browser.location.reload).toHaveBeenCalledOnce();
  });
});

describe("チームの一覧の page と試験", () => {
  it("AC-036 チームの一覧の page の作成の form は、必須のチーム名の入力と「チームを作る」を描き、失敗の alert を出す", async () => {
    const api = stubApi(MANAGER);
    api.replyTo("GET", TEAMS_PATH, { teams: [] });
    const dashboard = await startDashboard(TEAMS_ROUTE);
    await dashboard.idle();
    api.replyTo("POST", TEAMS_PATH, DUPLICATE_NAME, { status: 409 });

    dashboard.shows(
      expectInScene(teamNameInput).toHaveAttr("required"),
      ...hasClassesOfReact(teamNameInput, FIELD_CLASS_OF_REACT),
      expectInScene(buttonNamed("チームを作る")).toHaveAttr("type", "submit"),
    );
    dashboard.does(
      typeInto(teamNameInput, "開発"),
      submit(formWith(teamNameInput)),
    );
    await dashboard.idle();

    dashboard.shows(
      expectInScene(nth(alerts, 0)).toHaveText("同じ名前がすでにあります"),
    );
  });

  it("AC-037 web/src/dashboard の下に、スキルを足す form を描く Scene の試験と、チームの管理を扱う Story の試験が在る", () => {
    const scenes = gitGrepFiles("foldkit/scene", "web/src/dashboard");
    const stories = gitGrepFiles("foldkit/story", "web/src/dashboard");

    expect(
      scenes.filter((file) => gitGrepFiles("スキルを足す", file).length > 0),
    ).not.toEqual([]);
    expect(
      stories.filter((file) => gitGrepFiles("チームの管理", file).length > 0),
    ).not.toEqual([]);
  });

  it("AC-038 web/src/dashboard/pages に Command.mapMessage を書かない", () => {
    expect(
      gitGrepFiles("Command\\.mapMessage", "web/src/dashboard/pages"),
    ).toEqual([]);
  });
});
