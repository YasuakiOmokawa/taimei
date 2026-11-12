import { spawnSync } from "node:child_process";
import path from "node:path";
import { Effect, HashMap, ManagedRuntime, Option } from "effect";
import { AsyncData } from "foldkit";
import { UrlRequest } from "foldkit/navigation";
import { expect as expectInScene, given, role, scene } from "foldkit/scene";
import { fromString } from "foldkit/url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SkillId } from "../../../../db/ids";
import { SESSION_HEADER } from "../../../../src/spa-contract";
import { SpaHttpClient } from "../../shared/spa-http-client";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");
const ORIGIN = "https://app.example.com";

const TEAM_ID = "00000000-0000-4000-8000-0000000000aa";
const SKILL_ID = SkillId.make("00000000-0000-4000-8000-000000000001");
const MY_USER_ID = "u_1";

const ME_PATH = "/api/me";
const TEAMS_PATH = "/api/teams";
const TEAM_PATH = `/api/teams/${TEAM_ID}`;
const MEMBERS_PATH = "/api/members";

const TEAMS_ROUTE = "/dashboard/teams";
const TEAM_ROUTE = `/dashboard/teams/${TEAM_ID}`;
const MEMBERS_ROUTE = "/dashboard/members";

const ME = { userId: MY_USER_ID, name: "山田 花子", canManage: true };
const MEMBERS = {
  members: [{ name: "山田 花子", email: "hanako@example.com", role: "OWNER" }],
};
const teamsNamed = (name: string) => ({ teams: [{ id: TEAM_ID, name }] });
const teamPageWithMyLevel = (level: 0 | 1 | 2 | 3) => ({
  team: {
    id: TEAM_ID,
    name: "開発",
    skills: [{ id: SKILL_ID, name: "設計" }],
    assignedUserIds: [MY_USER_ID],
    levels: [
      { userId: MY_USER_ID, skillId: SKILL_ID, level, wantsToLearn: false },
    ],
  },
  members: [{ userId: MY_USER_ID, name: "山田 花子" }],
});
const SAVED_LEVEL_3 = {
  skillId: SKILL_ID,
  level: 3,
  wantsToLearn: true,
} as const;

const UNAUTHENTICATED = { _tag: "Unauthenticated" };
const SIX_MINUTES_MS = 6 * 60 * 1000;

const urlOf = (pathnameAndQuery: string) =>
  Option.getOrThrowWith(
    fromString(`${ORIGIN}${pathnameAndQuery}`),
    () => new Error(`URL として読めない: ${pathnameAndQuery}`),
  );

const runtimes: { dispose: () => Promise<void> }[] = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.dispose()));
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const stubBrowser = (pathname: string, search = "") => {
  const location = {
    href: `${ORIGIN}${pathname}${search}`,
    origin: ORIGIN,
    pathname,
    search,
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
    pushedPaths: () => pathsGivenTo(history.pushState),
    replacedPaths: () => pathsGivenTo(history.replaceState),
  };
};

const stubApi = () => {
  const getPaths: string[] = [];
  const replies = new Map<string, () => Response>();
  const holding = new Set<string>();
  const heldByPath = new Map<string, PromiseWithResolvers<Response>[]>();
  const replyTo = (apiPath: string, body: unknown, init?: ResponseInit) => {
    holding.delete(apiPath);
    replies.set(apiPath, () => Response.json(body, init));
  };
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const apiPath = new URL(input instanceof Request ? input.url : input)
      .pathname;
    if ((init?.method ?? "GET") === "GET") {
      getPaths.push(apiPath);
    }
    if (holding.has(apiPath)) {
      const held = Promise.withResolvers<Response>();
      heldByPath.set(apiPath, [...(heldByPath.get(apiPath) ?? []), held]);
      return held.promise;
    }
    const reply = replies.get(apiPath);
    return reply === undefined
      ? Promise.reject(new Error(`応答を決めていない path: ${apiPath}`))
      : Promise.resolve(reply());
  });
  replyTo(ME_PATH, ME);
  return {
    replyTo,
    hold: (apiPath: string) => {
      holding.add(apiPath);
    },
    release: (
      apiPath: string,
      order: number,
      body: unknown,
      init?: ResponseInit,
    ) => {
      const held = heldByPath.get(apiPath)?.[order];
      if (held === undefined) {
        throw new Error(`止めた要求が無い: ${apiPath} の ${order} 番目`);
      }
      held.resolve(Response.json(body, init));
    },
    getCountOf: (apiPath: string) =>
      getPaths.filter((requested) => requested === apiPath).length,
    getPaths: () => [...getPaths].sort(),
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
    runningCommands: () => running.size,
    apply,
    dispatch: (message: Message) => apply(update(current, message)),
    idle: async () => {
      while (running.size > 0) {
        await Promise.all(running);
      }
    },
  };
};

const clientRuntime = () => {
  const runtime = ManagedRuntime.make(SpaHttpClient.layer(ORIGIN));
  runtimes.push(runtime);
  return runtime;
};

const startDashboard = async (pathname: string, search = "") => {
  const browser = stubBrowser(pathname, search);
  const application = await import("../../app/dashboard/main");
  const runtime = clientRuntime();
  const driven = drive(
    application.update,
    (effect) => runtime.runPromise(effect),
    application.init(urlOf(`${pathname}${search}`)),
  );
  return {
    ...driven,
    application,
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
    reflect: async (
      changedOf: (
        changes: typeof import("../../dashboard/changed-by-mutation"),
      ) => Parameters<typeof application.reflectChange>[0],
    ) => {
      const changes = await import("../../dashboard/changed-by-mutation");
      driven.apply(
        application.reflectChange(changedOf(changes))(driven.model()),
      );
    },
  };
};

const startPublic = async (pathname: string) => {
  const browser = stubBrowser(pathname);
  const application = await import("../../app/public/main");
  const driven = drive(
    application.update,
    (effect) => Effect.runPromise(effect),
    application.init(urlOf(pathname)),
  );
  await driven.idle();
  return {
    ...driven,
    application,
    browser,
    clickInternalLink: (nextPathname: string) =>
      driven.dispatch(
        application.Message.ClickedLink({
          request: UrlRequest.Internal({ url: urlOf(nextPathname) }),
        }),
      ),
    titleShown: () => {
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
        given(driven.model()),
      );
      return titles.at(-1);
    },
  };
};

const valueOf = <Value, Failure>(
  cached: Readonly<{ data: AsyncData.AsyncData<Value, Failure> }> | undefined,
) =>
  cached === undefined
    ? undefined
    : Option.getOrUndefined(AsyncData.getData(cached.data));

type Dashboard = Awaited<ReturnType<typeof startDashboard>>;

const teamsOf = (dashboard: Dashboard) => valueOf(dashboard.model().teams);

const teamOf = (dashboard: Dashboard) =>
  valueOf(
    Option.getOrUndefined(HashMap.get(dashboard.model().teamById, TEAM_ID)),
  );

const myLevelsOf = (dashboard: Dashboard) =>
  teamOf(dashboard)?.team.levels.map(({ level }) => level);

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

const filesOf = (grepLines: readonly string[]) =>
  grepLines.map((line) => line.slice(0, line.indexOf(":")));

describe("application dashboard の route に入る時の cache", () => {
  it("AC-001 値の無い /dashboard/teams で開くと、チームの一覧の応答が届くまで一覧の値を持たず、届くとその値を持つ", async () => {
    const api = stubApi();
    api.hold(TEAMS_PATH);

    const dashboard = await startDashboard(TEAMS_ROUTE);
    await vi.waitFor(() => expect(api.getCountOf(TEAMS_PATH)).toBe(1));

    expect(teamsOf(dashboard)).toBeUndefined();
    api.release(TEAMS_PATH, 0, teamsNamed("開発"));
    await dashboard.idle();
    expect(teamsOf(dashboard)).toEqual(teamsNamed("開発"));
  });

  it.each([
    [TEAMS_ROUTE, [ME_PATH, TEAMS_PATH]],
    [TEAM_ROUTE, [ME_PATH, TEAM_PATH]],
    [MEMBERS_ROUTE, [MEMBERS_PATH, ME_PATH]],
  ])(
    "AC-002 %s を開くと、自分と、その route の値だけを 1 回ずつ取得する",
    async (route, requestedPaths) => {
      const api = stubApi();
      api.replyTo(TEAMS_PATH, teamsNamed("開発"));
      api.replyTo(TEAM_PATH, teamPageWithMyLevel(1));
      api.replyTo(MEMBERS_PATH, MEMBERS);

      const dashboard = await startDashboard(route);
      await dashboard.idle();

      expect(api.getPaths()).toEqual(requestedPaths);
    },
  );

  it("AC-003 前に値を取得した route へもう一度入ると、取り直しの応答を待たずに前の値を持ち、取り直しを 1 回送り、応答が届くと新しい値に替わる", async () => {
    const api = stubApi();
    api.replyTo(TEAMS_PATH, teamsNamed("前の一覧"));
    api.replyTo(MEMBERS_PATH, MEMBERS);
    const dashboard = await startDashboard(TEAMS_ROUTE);
    await dashboard.idle();
    dashboard.enter(MEMBERS_ROUTE);
    await dashboard.idle();
    api.hold(TEAMS_PATH);

    dashboard.enter(TEAMS_ROUTE);

    expect(teamsOf(dashboard)).toEqual(teamsNamed("前の一覧"));
    await vi.waitFor(() => expect(api.getCountOf(TEAMS_PATH)).toBe(2));
    api.release(TEAMS_PATH, 0, teamsNamed("新しい一覧"));
    await dashboard.idle();
    expect(teamsOf(dashboard)).toEqual(teamsNamed("新しい一覧"));
    expect(api.getCountOf(TEAMS_PATH)).toBe(2);
  });

  it("AC-004 後から始めた取得の応答の後に、前に始めた取得の応答が遅れて届いても、後の取得の値のまま変わらない", async () => {
    const api = stubApi();
    api.replyTo(TEAMS_PATH, teamsNamed("最初の一覧"));
    api.replyTo(MEMBERS_PATH, MEMBERS);
    const dashboard = await startDashboard(TEAMS_ROUTE);
    await dashboard.idle();
    dashboard.enter(MEMBERS_ROUTE);
    await dashboard.idle();
    api.hold(TEAMS_PATH);
    dashboard.enter(TEAMS_ROUTE);
    await vi.waitFor(() => expect(api.getCountOf(TEAMS_PATH)).toBe(2));
    await dashboard.reflect(({ ChangedByMutation }) =>
      ChangedByMutation.TeamList(),
    );
    dashboard.enter(MEMBERS_ROUTE);
    dashboard.enter(TEAMS_ROUTE);
    await vi.waitFor(() => expect(api.getCountOf(TEAMS_PATH)).toBe(3));

    api.release(TEAMS_PATH, 1, teamsNamed("後から始めた取得"));
    await vi.waitFor(() =>
      expect(teamsOf(dashboard)).toEqual(teamsNamed("後から始めた取得")),
    );
    api.release(TEAMS_PATH, 0, teamsNamed("前に始めた取得"));
    await dashboard.idle();

    expect(teamsOf(dashboard)).toEqual(teamsNamed("後から始めた取得"));
  });

  it("AC-005 値を取得してから 5 分を超えて時間が進んだ後に同じ route へ入っても、前の値を先に持つ", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const api = stubApi();
    api.replyTo(TEAMS_PATH, teamsNamed("前の一覧"));
    api.replyTo(MEMBERS_PATH, MEMBERS);
    const dashboard = await startDashboard(TEAMS_ROUTE);
    await dashboard.idle();
    dashboard.enter(MEMBERS_ROUTE);
    await dashboard.idle();
    vi.setSystemTime(Date.now() + SIX_MINUTES_MS);
    api.hold(TEAMS_PATH);

    dashboard.enter(TEAMS_ROUTE);

    expect(teamsOf(dashboard)).toEqual(teamsNamed("前の一覧"));
  });

  it.each([
    { timing: "応答が届く前に入っても", entersBeforeResponse: true },
    { timing: "応答が届いた後に入っても", entersBeforeResponse: false },
  ])(
    "AC-006 値の無い route の link に hover すると、その route の値を 1 回取得し、$timing 取得は 1 回のままで、その値を持つ",
    async ({ entersBeforeResponse }) => {
      const api = stubApi();
      api.replyTo(TEAMS_PATH, teamsNamed("開発"));
      const dashboard = await startDashboard(TEAMS_ROUTE);
      await dashboard.idle();
      const { DashboardRoute } = await import("../../app/dashboard/route");
      api.hold(TEAM_PATH);

      dashboard.dispatch(
        dashboard.application.Message.HoveredLink({
          route: DashboardRoute.Team({ teamId: TEAM_ID }),
        }),
      );
      await vi.waitFor(() => expect(api.getCountOf(TEAM_PATH)).toBe(1));
      api.replyTo(TEAM_PATH, teamPageWithMyLevel(2));
      if (!entersBeforeResponse) {
        api.release(TEAM_PATH, 0, teamPageWithMyLevel(1));
        await vi.waitFor(() =>
          expect(teamOf(dashboard)).toEqual(teamPageWithMyLevel(1)),
        );
      }
      dashboard.enter(TEAM_ROUTE);
      if (entersBeforeResponse) {
        api.release(TEAM_PATH, 0, teamPageWithMyLevel(1));
      }
      await dashboard.idle();

      expect(api.getCountOf(TEAM_PATH)).toBe(1);
      expect(teamOf(dashboard)).toEqual(teamPageWithMyLevel(1));
    },
  );

  it("AC-007 値の無い route の取得が失敗した後、もう一度その route へ入ると取り直し、届いた値を持つ", async () => {
    const api = stubApi();
    api.replyTo(TEAMS_PATH, null, { status: 500 });
    api.replyTo(MEMBERS_PATH, MEMBERS);
    const dashboard = await startDashboard(TEAMS_ROUTE);
    await dashboard.idle();
    expect(teamsOf(dashboard)).toBeUndefined();
    dashboard.enter(MEMBERS_ROUTE);
    await dashboard.idle();
    api.replyTo(TEAMS_PATH, teamsNamed("開発"));

    dashboard.enter(TEAMS_ROUTE);
    await dashboard.idle();

    expect(api.getCountOf(TEAMS_PATH)).toBe(2);
    expect(teamsOf(dashboard)).toEqual(teamsNamed("開発"));
  });

  it("AC-008 前の値が在る route の、裏の取り直しが失敗しても、前の値を持ち続ける", async () => {
    const api = stubApi();
    api.replyTo(TEAMS_PATH, teamsNamed("前の一覧"));
    api.replyTo(MEMBERS_PATH, MEMBERS);
    const dashboard = await startDashboard(TEAMS_ROUTE);
    await dashboard.idle();
    dashboard.enter(MEMBERS_ROUTE);
    await dashboard.idle();
    api.replyTo(TEAMS_PATH, null, { status: 503 });

    dashboard.enter(TEAMS_ROUTE);
    await dashboard.idle();

    expect(api.getCountOf(TEAMS_PATH)).toBe(2);
    expect(teamsOf(dashboard)).toEqual(teamsNamed("前の一覧"));
  });
});

describe("application dashboard が document を離れる時", () => {
  it("AC-009 API が 401 を返すと、今の path と query を callbackUrl にした /auth へ document ごと移る", async () => {
    const api = stubApi();
    api.replyTo(ME_PATH, UNAUTHENTICATED, { status: 401 });
    api.replyTo(TEAMS_PATH, UNAUTHENTICATED, { status: 401 });

    const dashboard = await startDashboard(TEAMS_ROUTE, "?tab=1");
    await dashboard.idle();

    expect(dashboard.browser.location.assign).toHaveBeenCalledWith(
      `/auth?callbackUrl=${encodeURIComponent("/dashboard/teams?tab=1")}`,
    );
  });

  it("AC-010 応答の session の印が最初の応答と違うと、document を読み直す", async () => {
    const api = stubApi();
    const markedAs = (mark: string) => ({
      headers: { [SESSION_HEADER]: mark },
    });
    api.replyTo(ME_PATH, ME, markedAs("company_a u_1"));
    api.replyTo(TEAMS_PATH, teamsNamed("開発"), markedAs("company_a u_1"));
    const dashboard = await startDashboard(TEAMS_ROUTE);
    await dashboard.idle();
    expect(dashboard.browser.location.reload).not.toHaveBeenCalled();
    api.replyTo(MEMBERS_PATH, MEMBERS, markedAs("company_b u_1"));

    dashboard.enter(MEMBERS_ROUTE);
    await dashboard.idle();

    expect(dashboard.browser.location.reload).toHaveBeenCalled();
  });

  it("AC-011 401 の応答を受けた取得は、その結果を application の update に渡すまで document を離れない", async () => {
    const browser = stubBrowser(TEAMS_ROUTE);
    const api = stubApi();
    api.replyTo(ME_PATH, UNAUTHENTICATED, { status: 401 });
    api.replyTo(TEAMS_PATH, UNAUTHENTICATED, { status: 401 });
    const application = await import("../../app/dashboard/main");
    const runtime = clientRuntime();
    const opened = application.init(urlOf(TEAMS_ROUTE));

    const results = await Promise.all(
      (opened.commands ?? []).map((command) =>
        runtime.runPromise(command.effect),
      ),
    );

    expect(results).not.toEqual([]);
    expect(browser.location.assign).not.toHaveBeenCalled();
    const afterUpdate = results.map((result) =>
      application.update(opened.model, result),
    );
    await Promise.all(
      afterUpdate.flatMap((step) =>
        (step.commands ?? []).map((command) =>
          runtime.runPromise(command.effect),
        ),
      ),
    );
    expect(browser.location.assign).toHaveBeenCalled();
  });
});

describe("application dashboard が、更新が変えたものを cache に反映する時", () => {
  const openTeamsThenTeam = async (api: ReturnType<typeof stubApi>) => {
    api.replyTo(TEAMS_PATH, teamsNamed("前の一覧"));
    api.replyTo(TEAM_PATH, teamPageWithMyLevel(1));
    const dashboard = await startDashboard(TEAMS_ROUTE);
    await dashboard.idle();
    dashboard.enter(TEAM_ROUTE);
    await dashboard.idle();
    return dashboard;
  };

  const expectNextTeamsEntryWaitsForRefetch = async (
    api: ReturnType<typeof stubApi>,
    dashboard: Dashboard,
  ) => {
    const teamsGetsBefore = api.getCountOf(TEAMS_PATH);
    api.hold(TEAMS_PATH);
    dashboard.enter(TEAMS_ROUTE);
    await vi.waitFor(() =>
      expect(api.getCountOf(TEAMS_PATH)).toBe(teamsGetsBefore + 1),
    );
    expect(teamsOf(dashboard)).toBeUndefined();
    api.release(TEAMS_PATH, 0, teamsNamed("取り直した一覧"));
    await dashboard.idle();
    expect(teamsOf(dashboard)).toEqual(teamsNamed("取り直した一覧"));
  };

  it("AC-012 チームの一覧を変えた更新を反映すると、取得を送らず、今持つ一覧の値は残り、次に一覧へ入ると取り直しの応答が届くまで前の値を持たない", async () => {
    const api = stubApi();
    const dashboard = await openTeamsThenTeam(api);
    const getsBefore = api.getPaths();

    await dashboard.reflect(({ ChangedByMutation }) =>
      ChangedByMutation.TeamList(),
    );
    await dashboard.idle();

    expect(api.getPaths()).toEqual(getsBefore);
    expect(teamsOf(dashboard)).toEqual(teamsNamed("前の一覧"));
    await expectNextTeamsEntryWaitsForRefetch(api, dashboard);
  });

  it("AC-013 チームを変えた更新を反映すると、そのチームを 1 回取り直し、応答が届くまで前の値を持ち、届くと新しい値に替わる。次に一覧へ入ると、取り直しの応答が届くまで前の値を持たない", async () => {
    const api = stubApi();
    const dashboard = await openTeamsThenTeam(api);
    api.hold(TEAM_PATH);

    await dashboard.reflect(({ ChangedByMutation }) =>
      ChangedByMutation.Team({ teamId: TEAM_ID }),
    );

    await vi.waitFor(() => expect(api.getCountOf(TEAM_PATH)).toBe(2));
    expect(teamOf(dashboard)).toEqual(teamPageWithMyLevel(1));
    api.release(TEAM_PATH, 0, teamPageWithMyLevel(2));
    await dashboard.idle();
    expect(teamOf(dashboard)).toEqual(teamPageWithMyLevel(2));
    expect(api.getCountOf(TEAM_PATH)).toBe(2);
    await expectNextTeamsEntryWaitsForRefetch(api, dashboard);
  });

  it("AC-014 チームを消した更新を反映すると、取得を送らず、次にそのチームへ入ると前の値を持たずに取り直し、次に一覧へ入ると取り直しの応答が届くまで前の値を持たない", async () => {
    const api = stubApi();
    const dashboard = await openTeamsThenTeam(api);
    const getsBefore = api.getPaths();

    await dashboard.reflect(({ ChangedByMutation }) =>
      ChangedByMutation.TeamDeleted({ teamId: TEAM_ID }),
    );
    await dashboard.idle();

    expect(api.getPaths()).toEqual(getsBefore);
    await expectNextTeamsEntryWaitsForRefetch(api, dashboard);
    api.hold(TEAM_PATH);
    dashboard.enter(TEAM_ROUTE);
    await vi.waitFor(() => expect(api.getCountOf(TEAM_PATH)).toBe(2));
    expect(teamOf(dashboard)).toBeUndefined();
    api.release(
      TEAM_PATH,
      0,
      { _tag: "TeamNotFound", teamId: TEAM_ID },
      { status: 404 },
    );
    await dashboard.idle();
    expect(teamOf(dashboard)).toBeUndefined();
  });

  it("AC-015 自分のレベルを保存した更新を反映すると、取得を送らず、そのチームの値の自分のレベルが保存した値に替わり、次に一覧へ入ると前の値を先に持つ", async () => {
    const api = stubApi();
    const dashboard = await openTeamsThenTeam(api);
    const getsBefore = api.getPaths();

    await dashboard.reflect(({ ChangedByMutation }) =>
      ChangedByMutation.MyLevels({
        teamId: TEAM_ID,
        myUserId: MY_USER_ID,
        entries: [SAVED_LEVEL_3],
      }),
    );
    await dashboard.idle();

    expect(api.getPaths()).toEqual(getsBefore);
    expect(teamOf(dashboard)?.team.levels).toEqual([
      { userId: MY_USER_ID, ...SAVED_LEVEL_3 },
    ]);
    api.hold(TEAMS_PATH);
    dashboard.enter(TEAMS_ROUTE);
    expect(teamsOf(dashboard)).toEqual(teamsNamed("前の一覧"));
  });

  it("AC-016 自分のレベルの保存の前に始まったチームの取得の応答が、保存を反映した後に届いても、保存した値を持ち続け、保存の後に取り直した値に替わる", async () => {
    const api = stubApi();
    const dashboard = await openTeamsThenTeam(api);
    dashboard.enter(TEAMS_ROUTE);
    await dashboard.idle();
    api.hold(TEAM_PATH);
    dashboard.enter(TEAM_ROUTE);
    await vi.waitFor(() => expect(api.getCountOf(TEAM_PATH)).toBe(2));

    await dashboard.reflect(({ ChangedByMutation }) =>
      ChangedByMutation.MyLevels({
        teamId: TEAM_ID,
        myUserId: MY_USER_ID,
        entries: [SAVED_LEVEL_3],
      }),
    );
    await vi.waitFor(() => expect(api.getCountOf(TEAM_PATH)).toBe(3));
    await vi.waitFor(() => expect(dashboard.runningCommands()).toBe(2));
    api.release(TEAM_PATH, 0, teamPageWithMyLevel(1));
    await vi.waitFor(() => expect(dashboard.runningCommands()).toBe(1));

    expect(myLevelsOf(dashboard)).toEqual([3]);
    api.release(TEAM_PATH, 1, teamPageWithMyLevel(2));
    await dashboard.idle();
    expect(myLevelsOf(dashboard)).toEqual([2]);
  });

  it("AC-017 web/src/app・web/src/dashboard・web/src/shared に、browser の storage と effect/persistence を書かない", () => {
    expect(
      gitGrepLines(
        "localStorage|sessionStorage|indexedDB|cookieStore|document\\.cookie|effect/persistence",
        "web/src/app",
        "web/src/dashboard",
        "web/src/shared",
      ),
    ).toEqual([]);
  });
});

describe("application dashboard の URL と link", () => {
  it("AC-018 /dashboard で開くと、履歴を増やさずに URL を /dashboard/teams に置き換える", async () => {
    const api = stubApi();
    api.replyTo(TEAMS_PATH, teamsNamed("開発"));

    const dashboard = await startDashboard("/dashboard");
    await dashboard.idle();

    expect(dashboard.browser.replacedPaths()).toEqual([TEAMS_ROUTE]);
    expect(dashboard.browser.pushedPaths()).toEqual([]);
    expect(dashboard.browser.location.assign).not.toHaveBeenCalled();
  });

  it("AC-019 dashboard の route への link を押すと document を読み直さずに URL を替え、dashboard の外の path への link を押すと document を読み直す", async () => {
    const api = stubApi();
    api.replyTo(TEAMS_PATH, teamsNamed("開発"));
    const dashboard = await startDashboard(TEAMS_ROUTE);
    await dashboard.idle();

    dashboard.clickInternalLink(MEMBERS_ROUTE);
    await dashboard.idle();

    expect(dashboard.browser.pushedPaths()).toEqual([MEMBERS_ROUTE]);
    expect(dashboard.browser.location.assign).not.toHaveBeenCalled();

    dashboard.clickInternalLink("/privacy");
    await dashboard.idle();

    expect(dashboard.browser.pushedPaths()).toEqual([MEMBERS_ROUTE]);
    expect(dashboard.browser.location.assign).toHaveBeenCalledExactlyOnceWith(
      `${ORIGIN}/privacy`,
    );
  });
});

describe("application public の link", () => {
  it("AC-020 / の画面でプライバシーポリシーの link を押すと、document を読み直さずに /privacy へ移り、title がプライバシーポリシーになる", async () => {
    const landing = await startPublic("/");
    scene(
      { update: landing.application.update, view: landing.application.view },
      given(landing.model()),
      expectInScene(role("link", { name: "プライバシーポリシー" })).toHaveAttr(
        "href",
        "/privacy",
      ),
    );

    landing.clickInternalLink("/privacy");
    await landing.idle();
    landing.dispatch(
      landing.application.Message.ChangedUrl({ url: urlOf("/privacy") }),
    );
    await landing.idle();

    expect(landing.browser.pushedPaths()).toEqual(["/privacy"]);
    expect(landing.browser.location.assign).not.toHaveBeenCalled();
    expect(landing.titleShown()).toBe("プライバシーポリシー");
  });

  it("AC-021 / の画面でログインの link を押すと、document を読み直して /auth へ移る", async () => {
    const landing = await startPublic("/");
    scene(
      { update: landing.application.update, view: landing.application.view },
      given(landing.model()),
      expectInScene(role("link", { name: "ログイン" })).toHaveAttr(
        "href",
        "/auth",
      ),
    );

    landing.clickInternalLink("/auth");
    await landing.idle();

    expect(landing.browser.location.assign).toHaveBeenCalledExactlyOnceWith(
      `${ORIGIN}/auth`,
    );
    expect(landing.browser.pushedPaths()).toEqual([]);
    expect(landing.browser.replacedPaths()).toEqual([]);
  });
});

describe("application の定義の置き方", () => {
  it("AC-022 web/src/app/public と web/src/app/dashboard に、URL を積む・置き換える Foldkit の関数の呼び出しを書かない", () => {
    expect(
      gitGrepLines(
        "(pushUrl|replaceUrl)\\(",
        "web/src/app/public",
        "web/src/app/dashboard",
      ),
    ).toEqual([]);
  });

  it("AC-023 web/src/app/__tests__/ の下に、application dashboard の定義を import する Story テストが在る", () => {
    const importingDashboard = filesOf(
      gitGrepLines('from "\\.\\./dashboard/main"', "web/src/app/__tests__"),
    );
    const importingStory = filesOf(
      gitGrepLines('from "foldkit/story"', "web/src/app/__tests__"),
    );

    expect(
      importingDashboard.filter((file) => importingStory.includes(file)),
    ).not.toEqual([]);
  });
});
