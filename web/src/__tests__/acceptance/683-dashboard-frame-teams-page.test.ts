import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { type Effect, ManagedRuntime, Option } from "effect";
import type { HtmlBuilder } from "foldkit/html";
import { UrlRequest } from "foldkit/navigation";
import {
  all,
  expectAll,
  expect as expectInScene,
  given,
  hover,
  label,
  nth,
  role,
  scene,
  selector,
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
const LINT_TIMEOUT_MS = 60_000;

const TEAM_ID = "00000000-0000-4000-8000-0000000000aa";
const OTHER_TEAM_ID = "00000000-0000-4000-8000-0000000000bb";
const CREATED_TEAM_ID = "00000000-0000-4000-8000-0000000000cc";

const ME_PATH = "/api/me";
const TEAMS_PATH = "/api/teams";
const TEAM_PATH = `/api/teams/${TEAM_ID}`;
const MEMBERS_PATH = "/api/members";

const TEAMS_ROUTE = "/dashboard/teams";
const TEAM_ROUTE = `/dashboard/teams/${TEAM_ID}`;
const CREATED_TEAM_ROUTE = `/dashboard/teams/${CREATED_TEAM_ID}`;
const MEMBERS_ROUTE = "/dashboard/members";
const PRIVACY_PATH = "/privacy";

const MANAGER = { userId: "u_1", name: "山田 花子", canManage: true };
const MEMBER = { userId: "u_2", name: "佐藤 次郎", canManage: false };
const MEMBERS = {
  members: [{ name: "山田 花子", email: "hanako@example.com", role: "OWNER" }],
};
const TEAM_PAGE = {
  team: {
    id: TEAM_ID,
    name: "開発",
    skills: [],
    assignedUserIds: [],
    levels: [],
  },
  members: null,
};
const teamsNamed = (...names: readonly string[]) => ({
  teams: names.map((name, index) => ({
    id: [TEAM_ID, OTHER_TEAM_ID][index] ?? `t_${index}`,
    name,
  })),
});

const UNAUTHENTICATED = { _tag: "Unauthenticated" };
const DUPLICATE_NAME = { _tag: "DuplicateName" };

const TEAM_LINK_CLASS_OF_REACT =
  "block px-6 py-4 text-sm font-medium hover:bg-muted/50";
const BRAND_LINK_CLASS_OF_REACT = "text-lg font-bold text-brand";
const SETTINGS_LINK_CLASS_OF_REACT =
  "text-muted-foreground underline-offset-4 hover:underline";
const PRIVACY_LINK_CLASS_OF_REACT =
  "text-xs text-muted-foreground underline underline-offset-4";

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
    creations: () => sentOf("POST", TEAMS_PATH).map(({ body }) => body),
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

const nameInput = label("チーム名");
const createButton = role("button", { name: "チームを作る" });
const createForm = selector("form");
const teamsHeading = role("heading", { name: "チーム" });
const navLink = (name: string) => role("link", { name });
const teamLinks = all.selector('a[href^="/dashboard/teams/"]');
const alerts = all.role("alert");

const openTeams = async (api: Api, ...names: readonly string[]) => {
  api.replyTo("GET", TEAMS_PATH, teamsNamed(...names));
  const dashboard = await startDashboard(TEAMS_ROUTE);
  await dashboard.idle();
  return dashboard;
};

const submitName = (dashboard: Dashboard, name: string) =>
  dashboard.does(typeInto(nameInput, name), submit(createForm));

const leaveForMembersAndReturnWhileListIsHeld = async (
  api: Api,
  dashboard: Dashboard,
) => {
  api.replyTo("GET", MEMBERS_PATH, MEMBERS);
  dashboard.enter(MEMBERS_ROUTE);
  await dashboard.idle();
  const listGetsBefore = api.getCountOf(TEAMS_PATH);
  api.hold("GET", TEAMS_PATH);
  dashboard.enter(TEAMS_ROUTE);
  await vi.waitFor(() =>
    expect(api.getCountOf(TEAMS_PATH)).toBe(listGetsBefore + 1),
  );
  return {
    releaseList: async (...names: readonly string[]) => {
      api.release("GET", TEAMS_PATH, 0, teamsNamed(...names));
      await dashboard.idle();
    },
  };
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

type OxlintReport = {
  readonly diagnostics: readonly {
    readonly filename: string;
    readonly labels: readonly { readonly span: { readonly line: number } }[];
  }[];
};

const lintedLinesOf = (fixtures: Readonly<Record<string, string>>) => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "taimei-683-lint-"));
  try {
    for (const entry of [".oxlintrc.json", "lint", "node_modules"]) {
      symlinkSync(path.join(REPO_ROOT, entry), path.join(fixtureDir, entry));
    }
    for (const [file, source] of Object.entries(fixtures)) {
      mkdirSync(path.dirname(path.join(fixtureDir, file)), {
        recursive: true,
      });
      writeFileSync(path.join(fixtureDir, file), source);
    }
    const report: OxlintReport = JSON.parse(
      spawnSync(
        path.join(REPO_ROOT, "node_modules/.bin/oxlint"),
        ["--disable-nested-config", "--format", "json"],
        { cwd: fixtureDir, encoding: "utf8" },
      ).stdout,
    );
    return Object.fromEntries(
      Object.keys(fixtures).map((file) => [
        file,
        [
          ...new Set(
            report.diagnostics
              .filter(({ filename }) => filename === file)
              .flatMap(({ labels }) => labels.map(({ span }) => span.line)),
          ),
        ].sort((left, right) => left - right),
      ]),
    );
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
};

describe("dashboard の枠", () => {
  it("AC-001 自分の応答が届くまで、nav の link も footer の link も見出しも描かない", async () => {
    const api = stubApi(MANAGER);
    api.hold("GET", ME_PATH);
    api.replyTo("GET", TEAMS_PATH, teamsNamed("開発"));

    const dashboard = await startDashboard(TEAMS_ROUTE);
    await vi.waitFor(() => expect(api.getCountOf(ME_PATH)).toBe(1));
    await vi.waitFor(() => expect(api.getCountOf(TEAMS_PATH)).toBe(1));

    dashboard.shows(
      expectAll(all.role("link")).toHaveCount(0),
      expectAll(all.role("heading")).toHaveCount(0),
    );
    api.release("GET", ME_PATH, 0, MANAGER);
    await dashboard.idle();
  });

  it("AC-002 自分の取得が失敗すると、「画面を読み込めませんでした」を描き、nav の link を描かない", async () => {
    const api = stubApi(MANAGER);
    api.replyTo("GET", ME_PATH, {}, { status: 500 });
    api.replyTo("GET", TEAMS_PATH, teamsNamed("開発"));

    const dashboard = await startDashboard(TEAMS_ROUTE);
    await dashboard.idle();

    dashboard.shows(
      expectInScene(text("画面を読み込めませんでした")).toExist(),
      expectAll(all.role("link")).toHaveCount(0),
    );
  });

  it("AC-003 自分の応答が届くと、Taimei の link、nav のチームとメンバーの link、自分の名前を描く", async () => {
    const dashboard = await openTeams(stubApi(MANAGER), "開発");

    dashboard.shows(
      expectInScene(navLink("Taimei")).toHaveAttr("href", TEAMS_ROUTE),
      expectInScene(navLink("Taimei")).toHaveAttr(
        "class",
        BRAND_LINK_CLASS_OF_REACT,
      ),
      expectInScene(navLink("チーム")).toHaveAttr("href", TEAMS_ROUTE),
      expectInScene(navLink("メンバー")).toHaveAttr("href", MEMBERS_ROUTE),
      expectInScene(text("山田 花子")).toExist(),
    );
  });

  it("AC-004 設定の link は、/auth/account を新しいタブで開き、rel と今と同じ class を持つ", async () => {
    const dashboard = await openTeams(stubApi(MANAGER), "開発");
    const settings = navLink("設定");

    dashboard.shows(
      expectInScene(settings).toHaveAttr("href", "/auth/account"),
      expectInScene(settings).toHaveAttr("target", "_blank"),
      expectInScene(settings).toHaveAttr("rel", "noopener noreferrer"),
      expectInScene(settings).toHaveAttr("class", SETTINGS_LINK_CLASS_OF_REACT),
    );
  });

  it("AC-005 footer のプライバシーポリシーの link は、/privacy を指し、今と同じ class を持つ", async () => {
    const dashboard = await openTeams(stubApi(MANAGER), "開発");
    const privacy = navLink("プライバシーポリシー");

    dashboard.shows(
      expectInScene(privacy).toHaveAttr("href", PRIVACY_PATH),
      expectInScene(privacy).toHaveAttr("class", PRIVACY_LINK_CLASS_OF_REACT),
    );
  });

  it("AC-006 footer のプライバシーポリシーの link を押すと、document を読み直して /privacy へ移り、画面の中では URL を替えない", async () => {
    const dashboard = await openTeams(stubApi(MANAGER), "開発");
    dashboard.shows(
      expectInScene(navLink("プライバシーポリシー")).toHaveAttr(
        "href",
        PRIVACY_PATH,
      ),
    );

    dashboard.clickInternalLink(PRIVACY_PATH);
    await dashboard.idle();

    expect(dashboard.browser.pathsLeftFor()).toEqual([PRIVACY_PATH]);
    expect(dashboard.browser.pushedPaths()).toEqual([]);
    expect(dashboard.browser.replacedPaths()).toEqual([]);
  });

  it.each([
    [TEAMS_ROUTE, "チーム", "メンバー"],
    [TEAM_ROUTE, "チーム", "メンバー"],
    [MEMBERS_ROUTE, "メンバー", "チーム"],
  ])(
    "AC-007 %s では、nav の %s の link が text-foreground を持ち、%s の link が text-muted-foreground を持つ",
    async (route, current, other) => {
      const api = stubApi(MANAGER);
      api.replyTo("GET", TEAMS_PATH, teamsNamed("開発"));
      api.replyTo("GET", TEAM_PATH, TEAM_PAGE);
      api.replyTo("GET", MEMBERS_PATH, MEMBERS);

      const dashboard = await startDashboard(route);
      await dashboard.idle();

      dashboard.shows(
        expectInScene(navLink(current)).toHaveClass("text-foreground"),
        expectInScene(navLink(current)).not.toHaveClass(
          "text-muted-foreground",
        ),
        expectInScene(navLink(other)).toHaveClass("text-muted-foreground"),
      );
    },
  );

  it("AC-008 title は、自分を待つ間も Taimei である", async () => {
    const api = stubApi(MANAGER);
    api.hold("GET", ME_PATH);
    api.replyTo("GET", TEAMS_PATH, teamsNamed("開発"));

    const dashboard = await startDashboard(TEAMS_ROUTE);
    await vi.waitFor(() => expect(api.getCountOf(ME_PATH)).toBe(1));

    expect(dashboard.title()).toBe("Taimei");
    api.release("GET", ME_PATH, 0, MANAGER);
    await dashboard.idle();
  });

  it("AC-008 title は、自分の取得が失敗した時も Taimei である", async () => {
    const api = stubApi(MANAGER);
    api.replyTo("GET", ME_PATH, {}, { status: 500 });
    api.replyTo("GET", TEAMS_PATH, teamsNamed("開発"));

    const dashboard = await startDashboard(TEAMS_ROUTE);
    await dashboard.idle();

    expect(dashboard.title()).toBe("Taimei");
  });

  it.each([TEAMS_ROUTE, MEMBERS_ROUTE])(
    "AC-008 title は、%s でも Taimei である",
    async (route) => {
      const api = stubApi(MANAGER);
      api.replyTo("GET", TEAMS_PATH, teamsNamed("開発"));
      api.replyTo("GET", MEMBERS_PATH, MEMBERS);

      const dashboard = await startDashboard(route);
      await dashboard.idle();

      expect(dashboard.title()).toBe("Taimei");
    },
  );
});

describe("チームの一覧", () => {
  it("AC-009 一覧の応答を待つ間、見出しのチームと、読み込み中であることを伝える status を描く", async () => {
    const api = stubApi(MANAGER);
    api.hold("GET", TEAMS_PATH);

    const dashboard = await startDashboard(TEAMS_ROUTE);
    await vi.waitFor(() => expect(api.getCountOf(TEAMS_PATH)).toBe(1));
    await vi.waitFor(() =>
      dashboard.shows(expectInScene(navLink("設定")).toExist()),
    );

    dashboard.shows(
      expectInScene(teamsHeading).toExist(),
      expectInScene(role("status")).toContainText("読み込み中"),
    );
    api.release("GET", TEAMS_PATH, 0, teamsNamed("開発"));
    await dashboard.idle();
  });

  it("AC-010 一覧の応答が届くと、説明の文と、チームごとの名前の link を応答の順に描く", async () => {
    const dashboard = await openTeams(stubApi(MANAGER), "開発", "営業");

    dashboard.shows(
      expectInScene(teamsHeading).toExist(),
      expectInScene(
        text("チームを開くと、星取表を見て自分のレベルを記入できます"),
      ).toExist(),
      expectAll(teamLinks).toHaveCount(2),
      expectInScene(nth(teamLinks, 0)).toHaveText("開発"),
      expectInScene(nth(teamLinks, 0)).toHaveAttr("href", TEAM_ROUTE),
      expectInScene(nth(teamLinks, 0)).toHaveAttr(
        "class",
        TEAM_LINK_CLASS_OF_REACT,
      ),
      expectInScene(nth(teamLinks, 1)).toHaveText("営業"),
      expectInScene(nth(teamLinks, 1)).toHaveAttr(
        "href",
        `/dashboard/teams/${OTHER_TEAM_ID}`,
      ),
    );
  });

  it("AC-011 一覧が空で、自分が管理者なら、チームを作る案内を描く", async () => {
    const dashboard = await openTeams(stubApi(MANAGER));

    dashboard.shows(
      expectInScene(
        text(
          "まだチームがありません。チームを作ると、スキルを足してメンバーを割り当てられます",
        ),
      ).toExist(),
    );
  });

  it("AC-012 一覧が空で、自分が管理者でなければ、割り当てを頼む案内を描く", async () => {
    const dashboard = await openTeams(stubApi(MEMBER));

    dashboard.shows(
      expectInScene(
        text(
          "まだどのチームにも割り当てられていません。管理者に割り当てを頼んでください",
        ),
      ).toExist(),
    );
  });

  it("AC-013 一覧の取得が失敗すると、見出しのチームと「チームを取得できませんでした」を描き、作成の form を描かない", async () => {
    const api = stubApi(MANAGER);
    api.replyTo("GET", TEAMS_PATH, {}, { status: 500 });

    const dashboard = await startDashboard(TEAMS_ROUTE);
    await dashboard.idle();

    dashboard.shows(
      expectInScene(teamsHeading).toExist(),
      expectInScene(text("チームを取得できませんでした")).toExist(),
      expectAll(all.label("チーム名")).toHaveCount(0),
      expectAll(all.role("button", { name: "チームを作る" })).toHaveCount(0),
    );
  });
});

describe("チームの作成", () => {
  it("AC-014 自分が管理者なら、チーム名の必須の input と、submit の button「チームを作る」を描く", async () => {
    const dashboard = await openTeams(stubApi(MANAGER), "開発");

    dashboard.shows(
      expectInScene(nameInput).toHaveAttr("required"),
      expectInScene(nameInput).toHaveAttr("placeholder", "チーム名"),
      expectInScene(createButton).toHaveAttr("type", "submit"),
    );
  });

  it("AC-015 自分が管理者でなければ、チーム名の input も「チームを作る」の button も描かない", async () => {
    const dashboard = await openTeams(stubApi(MEMBER), "開発");

    dashboard.shows(
      expectAll(teamLinks).toHaveCount(1),
      expectAll(all.label("チーム名")).toHaveCount(0),
      expectAll(all.role("button", { name: "チームを作る" })).toHaveCount(0),
    );
  });

  it("AC-016 名前を入れて送信すると、その名前の作成を 1 回送り、成功すると、応答の id のチームの画面へ document を読み直さずに移る", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeams(api, "開発");
    api.replyTo("POST", TEAMS_PATH, { id: CREATED_TEAM_ID });

    submitName(dashboard, "新しいチーム");
    await dashboard.idle();

    expect(api.creations()).toEqual([{ name: "新しいチーム" }]);
    expect(dashboard.browser.pushedPaths()).toEqual([CREATED_TEAM_ROUTE]);
    expect(dashboard.browser.location.assign).not.toHaveBeenCalled();
    expect(dashboard.browser.location.reload).not.toHaveBeenCalled();
  });

  it("AC-017 作成が成功した後に一覧へ入ると、取り直しの応答が届くまで前の一覧を描かず、届くと新しい一覧を描く", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeams(api, "開発");
    api.replyTo("POST", TEAMS_PATH, { id: CREATED_TEAM_ID });
    submitName(dashboard, "営業");
    await dashboard.idle();

    const returned = await leaveForMembersAndReturnWhileListIsHeld(
      api,
      dashboard,
    );

    dashboard.shows(expectAll(teamLinks).toHaveCount(0));
    await returned.releaseList("開発", "営業");
    dashboard.shows(
      expectAll(teamLinks).toHaveCount(2),
      expectInScene(nth(teamLinks, 1)).toHaveText("営業"),
    );
  });

  it("AC-018 作成の応答を待つ間、「チームを作る」の button は無効である", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeams(api, "開発");
    api.hold("POST", TEAMS_PATH);
    dashboard.shows(expectInScene(createButton).not.toBeDisabled());

    submitName(dashboard, "新しいチーム");
    await vi.waitFor(() => expect(api.creations()).toHaveLength(1));

    dashboard.shows(expectInScene(createButton).toBeDisabled());
    api.release("POST", TEAMS_PATH, 0, { id: CREATED_TEAM_ID });
    await dashboard.idle();
  });

  it("AC-019 作成の応答を待つ間にもう一度送信しても、作成の要求は 1 回のままである", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeams(api, "開発");
    api.hold("POST", TEAMS_PATH);
    submitName(dashboard, "新しいチーム");
    await vi.waitFor(() => expect(api.creations()).toHaveLength(1));

    dashboard.does(submit(createForm));
    api.release("POST", TEAMS_PATH, 0, { id: CREATED_TEAM_ID });
    await dashboard.idle();

    expect(api.creations()).toEqual([{ name: "新しいチーム" }]);
  });

  it("AC-020 同じ名前のチームが在って作成が失敗すると、alert に「同じ名前がすでにあります」を描き、画面は移らない", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeams(api, "開発");
    api.replyTo("POST", TEAMS_PATH, DUPLICATE_NAME, { status: 409 });

    submitName(dashboard, "開発");
    await dashboard.idle();

    dashboard.shows(
      expectInScene(role("alert")).toHaveText("同じ名前がすでにあります"),
    );
    expect(dashboard.browser.pushedPaths()).toEqual([]);
    expect(dashboard.browser.location.assign).not.toHaveBeenCalled();
  });

  it("AC-021 作成が契約の外の失敗で終わると、alert に「チームを作れませんでした」を描く", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeams(api, "開発");
    api.replyTo("POST", TEAMS_PATH, {}, { status: 500 });

    submitName(dashboard, "新しいチーム");
    await dashboard.idle();

    dashboard.shows(
      expectInScene(role("alert")).toHaveText("チームを作れませんでした"),
    );
  });

  it("AC-022 作成が失敗した後に一覧へ入り直すと、取り直しの応答を待たずに前の一覧を描く", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeams(api, "開発");
    api.replyTo("POST", TEAMS_PATH, DUPLICATE_NAME, { status: 409 });
    submitName(dashboard, "開発");
    await dashboard.idle();

    const returned = await leaveForMembersAndReturnWhileListIsHeld(
      api,
      dashboard,
    );

    dashboard.shows(
      expectAll(teamLinks).toHaveCount(1),
      expectInScene(nth(teamLinks, 0)).toHaveText("開発"),
    );
    await returned.releaseList("開発");
  });

  it("AC-023 失敗の後にもう一度送信して成功すると、alert が消える", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeams(api, "開発");
    api.replyTo("POST", TEAMS_PATH, DUPLICATE_NAME, { status: 409 });
    submitName(dashboard, "開発");
    await dashboard.idle();
    dashboard.shows(expectAll(alerts).toHaveCount(1));
    api.replyTo("POST", TEAMS_PATH, { id: CREATED_TEAM_ID });

    submitName(dashboard, "営業");
    await dashboard.idle();

    expect(api.creations()).toEqual([{ name: "開発" }, { name: "営業" }]);
    dashboard.shows(expectAll(alerts).toHaveCount(0));
  });

  it("AC-024 作成の応答が 401 だと、今の path を callbackUrl にした /auth へ document ごと移る", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeams(api, "開発");
    api.replyTo("POST", TEAMS_PATH, UNAUTHENTICATED, { status: 401 });

    submitName(dashboard, "新しいチーム");
    await dashboard.idle();

    expect(dashboard.browser.location.assign).toHaveBeenCalledWith(
      `/auth?callbackUrl=${encodeURIComponent(TEAMS_ROUTE)}`,
    );
    expect(dashboard.browser.pushedPaths()).toEqual([]);
  });

  it("AC-025 作成の応答の session の印が最初の応答と違うと、document を読み直し、新しいチームの画面へは移らない", async () => {
    const api = stubApi(MANAGER);
    const markedAs = (mark: string) => ({
      headers: { [SESSION_HEADER]: mark },
    });
    api.replyTo("GET", ME_PATH, MANAGER, markedAs("company_a u_1"));
    api.replyTo(
      "GET",
      TEAMS_PATH,
      teamsNamed("開発"),
      markedAs("company_a u_1"),
    );
    const dashboard = await startDashboard(TEAMS_ROUTE);
    await dashboard.idle();
    expect(dashboard.browser.location.reload).not.toHaveBeenCalled();
    api.replyTo(
      "POST",
      TEAMS_PATH,
      { id: CREATED_TEAM_ID },
      markedAs("company_b u_1"),
    );

    submitName(dashboard, "新しいチーム");
    await dashboard.idle();

    expect(dashboard.browser.location.reload).toHaveBeenCalledOnce();
    expect(dashboard.browser.pushedPaths()).toEqual([]);
  });

  it("AC-028 名前を入れて作成に失敗した後、一覧を離れて戻ると、名前の input は空で、alert は無い", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeams(api, "開発");
    api.replyTo("POST", TEAMS_PATH, DUPLICATE_NAME, { status: 409 });
    submitName(dashboard, "開発");
    await dashboard.idle();
    dashboard.shows(expectAll(alerts).toHaveCount(1));
    api.replyTo("GET", MEMBERS_PATH, MEMBERS);

    dashboard.enter(MEMBERS_ROUTE);
    await dashboard.idle();
    dashboard.enter(TEAMS_ROUTE);
    await dashboard.idle();

    dashboard.shows(
      expectInScene(nameInput).toHaveValue(""),
      expectAll(alerts).toHaveCount(0),
    );
  });

  it("AC-029 作成の応答を待つ間に一覧を離れ、その後に成功が届いても、新しいチームの画面へ移り、次に一覧へ入ると取り直しの応答が届くまで前の一覧を描かない", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeams(api, "開発");
    api.hold("POST", TEAMS_PATH);
    api.replyTo("GET", MEMBERS_PATH, MEMBERS);
    submitName(dashboard, "営業");
    await vi.waitFor(() => expect(api.creations()).toHaveLength(1));
    dashboard.enter(MEMBERS_ROUTE);
    await vi.waitFor(() => expect(api.getCountOf(MEMBERS_PATH)).toBe(1));

    api.release("POST", TEAMS_PATH, 0, { id: CREATED_TEAM_ID });
    await dashboard.idle();

    expect(dashboard.browser.pushedPaths()).toEqual([CREATED_TEAM_ROUTE]);
    const returned = await leaveForMembersAndReturnWhileListIsHeld(
      api,
      dashboard,
    );
    dashboard.shows(expectAll(teamLinks).toHaveCount(0));
    await returned.releaseList("開発", "営業");
  });
});

describe("link の hover での先読み", () => {
  it("AC-026 一覧のチームの link に hover すると、そのチームを 1 回取得し、続けてそのチームの route へ入っても取得は 1 回のままである", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeams(api, "開発");
    api.replyTo("GET", TEAM_PATH, TEAM_PAGE);
    expect(api.getCountOf(TEAM_PATH)).toBe(0);

    dashboard.does(hover(nth(teamLinks, 0)));
    await dashboard.idle();
    expect(api.getCountOf(TEAM_PATH)).toBe(1);
    dashboard.enter(TEAM_ROUTE);
    await dashboard.idle();

    expect(api.getCountOf(TEAM_PATH)).toBe(1);
  });

  it("AC-027 nav のメンバーの link に hover すると、メンバーの一覧を 1 回取得し、続けて /dashboard/members へ入っても取得は 1 回のままである", async () => {
    const api = stubApi(MANAGER);
    const dashboard = await openTeams(api, "開発");
    api.replyTo("GET", MEMBERS_PATH, MEMBERS);
    expect(api.getCountOf(MEMBERS_PATH)).toBe(0);

    dashboard.does(hover(navLink("メンバー")));
    await dashboard.idle();
    expect(api.getCountOf(MEMBERS_PATH)).toBe(1);
    dashboard.enter(MEMBERS_ROUTE);
    await dashboard.idle();

    expect(api.getCountOf(MEMBERS_PATH)).toBe(1);
  });
});

describe("試験と lint", () => {
  it("AC-030 web/src/dashboard の下に、Foldkit の Story で書いた試験と Scene で書いた試験が在る", () => {
    expect(
      gitGrepLines('from "foldkit/story"', "web/src/dashboard"),
    ).not.toEqual([]);
    expect(
      gitGrepLines('from "foldkit/scene"', "web/src/dashboard"),
    ).not.toEqual([]);
  });

  const MUTATION_ENDPOINTS_BY_HAND = [
    "declare const client: {",
    "  teamManagement: { create: (input: object) => object };",
    "  myLevels: { saveMyLevels: (input: object) => object };",
    "};",
    "export const created = client.teamManagement.create({});",
    "export const saved = client.myLevels.saveMyLevels({});",
    "",
  ].join("\n");

  it(
    "AC-031 page と application の file に書いた、更新の endpoint を読む行を、lint が指摘する",
    () => {
      expect(
        lintedLinesOf({
          "web/src/dashboard/pages/Probe.ts": MUTATION_ENDPOINTS_BY_HAND,
          "web/src/app/dashboard/main.ts": MUTATION_ENDPOINTS_BY_HAND,
        }),
      ).toEqual({
        "web/src/dashboard/pages/Probe.ts": [5, 6],
        "web/src/app/dashboard/main.ts": [5, 6],
      });
    },
    LINT_TIMEOUT_MS,
  );

  const KEYED_ELEMENTS = [
    'import type { Html, HtmlBuilder } from "foldkit/html";',
    "export const rowViews = <Message>(",
    "  h: HtmlBuilder<Message>,",
    "): ReadonlyArray<Html> => [",
    '  h.keyed("button")("a", []),',
    '  h.keyed("input")("b", []),',
    '  h.keyed("select")("c", []),',
    '  h.keyed("textarea")("d", []),',
    '  h.keyed("li")("e", []),',
    "];",
    "",
  ].join("\n");

  it(
    "AC-032 page の file に書いた h.keyed の form の要素の行を lint が指摘し、h.keyed の li の行と、web/src/shared/ui/ の下の同じ行は指摘しない",
    () => {
      expect(
        lintedLinesOf({
          "web/src/dashboard/pages/Probe.ts": KEYED_ELEMENTS,
          "web/src/shared/ui/probe-view.ts": KEYED_ELEMENTS,
        }),
      ).toEqual({
        "web/src/dashboard/pages/Probe.ts": [5, 6, 7, 8],
        "web/src/shared/ui/probe-view.ts": [],
      });
    },
    LINT_TIMEOUT_MS,
  );
});
