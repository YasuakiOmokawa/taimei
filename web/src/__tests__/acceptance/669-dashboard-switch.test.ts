import path from "node:path";
import { type Effect, ManagedRuntime, Option } from "effect";
import type { Document, HtmlBuilder } from "foldkit/html";
import {
  expect as expectInScene,
  given,
  role,
  scene,
  text,
} from "foldkit/scene";
import { fromString } from "foldkit/url";
import { build, type Rollup } from "vite";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { SESSION_HEADER } from "../../../../src/spa-contract";
import { SpaHttpClient } from "../../shared/spa-http-client";

const WEB_ROOT = path.resolve(import.meta.dirname, "../../..");
const REPO_ROOT = path.resolve(WEB_ROOT, "..");
const ORIGIN = "https://app.example.com";

const ME_PATH = "/api/me";
const TEAMS_PATH = "/api/teams";
const MEMBERS_PATH = "/api/members";

const TEAMS_ROUTE = "/dashboard/teams";
const MEMBERS_ROUTE = "/dashboard/members";

const TEAM_ID = "00000000-0000-4000-8000-0000000000aa";
const ME = { userId: "u_1", name: "山田 花子", canManage: true };
const MEMBERS = {
  members: [{ name: "山田 花子", email: "hanako@example.com", role: "OWNER" }],
};
const teamsNamed = (name: string) => ({ teams: [{ id: TEAM_ID, name }] });
const UNAUTHENTICATED = { _tag: "Unauthenticated" };
const FIRST_MARK = "company_a u_1";
const CHANGED_MARK = "company_b u_1";
const markedAs = (mark: string) => ({ headers: { [SESSION_HEADER]: mark } });

const REACT_PACKAGE_PATH =
  /\/node_modules\/(react|react-dom|@tanstack\/react-router|@effect\/atom-react|lucide-react|@radix-ui\/react-slot)\//;
const CONTRACT_MODULES = [
  "src/spa-contract.ts",
  "db/ids.ts",
  "db/column-values.ts",
].map((file) => path.join(REPO_ROOT, file));
const SERVER_ONLY_PACKAGE_PATH =
  /\/node_modules\/(pg|pg-[^/]+|drizzle-orm|@sentry\/[^/]+|@taimei-code\/auth-client|@connectrpc\/[^/]+|@bufbuild\/[^/]+)\//;
const SECRET_NAMES = [
  "AUTH_SERVICE_KEY",
  "AUTH_SERVICE_URL",
  "HYPERDRIVE",
  "DATABASE_URL",
  "SENTRY_DSN",
];
const BUILD_TIMEOUT_MS = 120_000;

const urlOf = (pathnameAndQuery: string) =>
  Option.getOrThrowWith(
    fromString(`${ORIGIN}${pathnameAndQuery}`),
    () => new Error(`URL として読めない: ${pathnameAndQuery}`),
  );

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const stubBrowser = (pathname: string, search = "") => {
  const location = {
    href: `${ORIGIN}${pathname}${search}`,
    origin: ORIGIN,
    pathname,
    search,
    hash: "",
    assign: vi.fn(),
    replace: vi.fn(),
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
  return { location };
};

const stubApi = () => {
  const replies = new Map<string, () => Response>();
  const holding = new Set<string>();
  const heldByPath = new Map<string, PromiseWithResolvers<Response>[]>();
  const replyTo = (apiPath: string, body: unknown, init?: ResponseInit) => {
    holding.delete(apiPath);
    replies.set(apiPath, () => Response.json(body, init));
  };
  vi.stubGlobal("fetch", (input: RequestInfo | URL) => {
    const apiPath = new URL(input instanceof Request ? input.url : input)
      .pathname;
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
    release: (apiPath: string, order: number, body: unknown) => {
      const held = heldByPath.get(apiPath)?.[order];
      if (held === undefined) {
        throw new Error(`止めた要求が無い: ${apiPath} の ${order} 番目`);
      }
      held.resolve(Response.json(body));
    },
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

const startDashboard = async (pathname: string, search = "") => {
  const browser = stubBrowser(pathname, search);
  const application = await import("../../app/dashboard/main");
  type Model = ReturnType<typeof application.init>["model"];
  type Message = Parameters<typeof application.update>[1];
  type SceneStep = Parameters<typeof scene<Model, Message>>[1];
  const runtime = ManagedRuntime.make(SpaHttpClient.layer(ORIGIN));
  const driven = drive(
    application.update,
    (effect) => runtime.runPromise(effect),
    application.init(urlOf(`${pathname}${search}`)),
  );
  const titles: string[] = [];
  const drawn = (shown: Model, h: HtmlBuilder<Message>) => {
    const document: Document = application.view(shown, h);
    titles.push(document.title);
    return { ...document, body: document.body ?? h.div([], []) };
  };
  return {
    ...driven,
    browser,
    enter: (nextPathname: string) =>
      driven.dispatch(
        application.Message.ChangedUrl({ url: urlOf(nextPathname) }),
      ),
    shows: (...expectations: ReadonlyArray<SceneStep>) => {
      scene(
        {
          update: (shown: Model, message: Message) => ({
            model: application.update(shown, message).model,
          }),
          view: drawn,
        },
        given(driven.model()),
        ...expectations,
      );
    },
    lastTitle: () => titles.at(-1),
  };
};

const leavingCallsOf = (location: ReturnType<typeof stubBrowser>["location"]) =>
  location.assign.mock.calls.length + location.reload.mock.calls.length;

const openTeamsMarked = async (api: ReturnType<typeof stubApi>) => {
  api.replyTo(ME_PATH, ME, markedAs(FIRST_MARK));
  api.replyTo(TEAMS_PATH, teamsNamed("開発"), markedAs(FIRST_MARK));
  const dashboard = await startDashboard(TEAMS_ROUTE);
  await dashboard.idle();
  return dashboard;
};

describe("dashboard が document を離れる時", () => {
  it("AC-003 最初の表示で自分の情報と一覧の取得がどちらも 401 を受けると、今の path と query を callbackUrl にした /auth へ document ごと 1 回だけ移り、読み直さない", async () => {
    const api = stubApi();
    api.replyTo(ME_PATH, UNAUTHENTICATED, { status: 401 });
    api.replyTo(TEAMS_PATH, UNAUTHENTICATED, { status: 401 });

    const dashboard = await startDashboard(TEAMS_ROUTE, "?tab=1");
    await dashboard.idle();

    expect(dashboard.browser.location.assign).toHaveBeenCalledExactlyOnceWith(
      `/auth?callbackUrl=${encodeURIComponent("/dashboard/teams?tab=1")}`,
    );
    expect(dashboard.browser.location.reload).not.toHaveBeenCalled();
  });

  it("AC-004 別の route へ入った時の 2 つの取得の応答がどちらも最初と違う session の印を持つと、document を 1 回だけ読み直し、/auth へ移らない", async () => {
    const api = stubApi();
    const dashboard = await openTeamsMarked(api);
    expect(leavingCallsOf(dashboard.browser.location)).toBe(0);
    api.replyTo(ME_PATH, ME, markedAs(CHANGED_MARK));
    api.replyTo(MEMBERS_PATH, MEMBERS, markedAs(CHANGED_MARK));

    dashboard.enter(MEMBERS_ROUTE);
    await dashboard.idle();

    expect(dashboard.browser.location.reload).toHaveBeenCalledExactlyOnceWith();
    expect(dashboard.browser.location.assign).not.toHaveBeenCalled();
  });

  it("AC-005 別の route へ入った時の取得の一方が 401 を受け、もう一方の応答が最初と違う session の印を持つと、/auth への移動と読み直しのうち 1 つだけを 1 回行う", async () => {
    const api = stubApi();
    const dashboard = await openTeamsMarked(api);
    api.replyTo(ME_PATH, UNAUTHENTICATED, { status: 401 });
    api.replyTo(MEMBERS_PATH, MEMBERS, markedAs(CHANGED_MARK));

    dashboard.enter(MEMBERS_ROUTE);
    await dashboard.idle();

    expect(leavingCallsOf(dashboard.browser.location)).toBe(1);
  });
});

describe("dashboard の画面", () => {
  it("AC-006 前に見た一覧へ戻ると、取り直しの応答を待つ間は前の一覧を描き、応答の後は新しい一覧を描く", async () => {
    const api = stubApi();
    api.replyTo(TEAMS_PATH, teamsNamed("前の一覧"));
    api.replyTo(MEMBERS_PATH, MEMBERS);
    const dashboard = await startDashboard(TEAMS_ROUTE);
    await dashboard.idle();
    dashboard.enter(MEMBERS_ROUTE);
    await dashboard.idle();
    api.hold(TEAMS_PATH);

    dashboard.enter(TEAMS_ROUTE);

    dashboard.shows(
      expectInScene(role("link", { name: "前の一覧" })).toExist(),
      expectInScene(role("status")).not.toExist(),
    );
    api.release(TEAMS_PATH, 0, teamsNamed("新しい一覧"));
    await dashboard.idle();
    dashboard.shows(
      expectInScene(role("link", { name: "新しい一覧" })).toExist(),
      expectInScene(text("前の一覧")).not.toExist(),
    );
  });

  it("AC-009 /dashboard/teams で自分の情報の取得が失敗した画面の title は Taimei である", async () => {
    const api = stubApi();
    api.replyTo(ME_PATH, "Internal Server Error", { status: 500 });
    api.replyTo(TEAMS_PATH, teamsNamed("開発"));
    const dashboard = await startDashboard(TEAMS_ROUTE);
    await dashboard.idle();

    dashboard.shows(
      expectInScene(text("画面を読み込めませんでした")).toExist(),
    );
    expect(dashboard.lastTitle()).toBe("Taimei");
  });

  it("AC-010 /dashboard/teams の画面の title は Taimei である", async () => {
    const api = stubApi();
    api.replyTo(TEAMS_PATH, teamsNamed("開発"));
    const dashboard = await startDashboard(TEAMS_ROUTE);
    await dashboard.idle();

    dashboard.shows(expectInScene(role("link", { name: "開発" })).toExist());
    expect(dashboard.lastTitle()).toBe("Taimei");
  });
});

const buildSpa = async () => {
  vi.stubEnv("NODE_ENV", "production");
  const result = (await build({
    configFile: path.join(WEB_ROOT, "vite.config.ts"),
    mode: "production",
    logLevel: "silent",
    build: { write: false },
  })) as Rollup.RollupOutput | Rollup.RollupOutput[];
  return [result].flat().flatMap((o) => o.output);
};

describe("SPA の build の成果物", () => {
  let moduleIds: string[] = [];
  let emittedTexts: string[] = [];

  beforeAll(async () => {
    const output = await buildSpa();
    vi.unstubAllEnvs();
    moduleIds = output.flatMap((o) =>
      o.type === "chunk" ? Object.keys(o.modules) : [],
    );
    emittedTexts = output
      .map((o) => (o.type === "chunk" ? o.code : o.source))
      .filter((emitted) => typeof emitted === "string");
  }, BUILD_TIMEOUT_MS);

  it("AC-011 React と React 用の package の module を入れない", () => {
    expect(moduleIds.length).toBeGreaterThan(0);
    expect(moduleIds.filter((id) => REACT_PACKAGE_PATH.test(id))).toEqual([]);
  });

  it("AC-012 web の外の module は契約の 3 file だけで、server だけが使う package の module と秘密の名前を入れない", () => {
    expect(moduleIds.length).toBeGreaterThan(0);
    expect({
      outsideWeb: moduleIds
        .filter(
          (id) =>
            !id.startsWith("\0") &&
            !id.includes("/node_modules/") &&
            !id.startsWith(`${WEB_ROOT}/`),
        )
        .sort(),
      serverOnly: moduleIds.filter((id) => SERVER_ONLY_PACKAGE_PATH.test(id)),
      secrets: SECRET_NAMES.filter((name) =>
        emittedTexts.some((emitted) => emitted.includes(name)),
      ),
    }).toEqual({
      outsideWeb: [...CONTRACT_MODULES].sort(),
      serverOnly: [],
      secrets: [],
    });
  });
});
