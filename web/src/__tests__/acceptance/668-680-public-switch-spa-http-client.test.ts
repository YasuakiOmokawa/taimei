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
import { Cause, Exit, ManagedRuntime, Option } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NAME_MAX_LENGTH } from "../../../../db/column-values";
import {
  DuplicateName,
  InvalidLevel,
  InvalidName,
  NotAssigned,
  NotCompanyMember,
  NotManager,
  SESSION_HEADER,
  SessionChanged,
  SkillNotFound,
  TeamNotFound,
  Unauthenticated,
} from "../../../../src/spa-contract";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");
const ORIGIN = "http://app.example";
const LINT_TIMEOUT_MS = 60_000;
const DOM_ADOPTING_START = ["hyd", "rate"].join("");

afterEach(() => {
  vi.unstubAllGlobals();
});

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
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "taimei-668-680-lint-"));
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

const ME = { userId: "u_1", name: "山田", canManage: false };

const markedResponse = (body: unknown, mark: string) =>
  Response.json(body, { headers: { [SESSION_HEADER]: mark } });

const stubFetch = (responses: readonly Response[]) => {
  const queue = [...responses];
  const fetch = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) => {
      const response = queue.shift();
      if (response === undefined) {
        throw new Error("用意した応答より多く fetch が呼ばれた");
      }
      return response;
    },
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

const stubLocation = () => {
  const location = {
    origin: ORIGIN,
    pathname: "/dashboard/teams",
    search: "?tab=1",
    hash: "",
    href: `${ORIGIN}/dashboard/teams?tab=1`,
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  };
  vi.stubGlobal("location", location);
  vi.stubGlobal("window", { location });
  return location;
};

const sessionMarkOf = ([input, init]: readonly [
  RequestInfo | URL,
  RequestInit?,
]) => new Request(input, init).headers.get(SESSION_HEADER);

const startMeClient = async () => {
  const { SpaHttpClient } = await import("../../shared/spa-http-client");
  const runtime = ManagedRuntime.make(SpaHttpClient.layer(ORIGIN));
  return () =>
    runtime.runPromiseExit(SpaHttpClient.use((client) => client.me.get()));
};

const failureTagOf = <A, E extends { readonly _tag: string }>(
  exit: Exit.Exit<A, E>,
) =>
  Exit.isFailure(exit)
    ? Option.getOrUndefined(
        Option.map(Cause.findErrorOption(exit.cause), ({ _tag }) => _tag),
      )
    : undefined;

describe("#668 公開ページを Foldkit に切り替える", () => {
  it("AC-013 利用者に届く web の code に、描画済みの DOM を引き継いで起動する呼び出しが無い", () => {
    expect(
      gitGrepLines(DOM_ADOPTING_START, "web/src", "web/index.html"),
    ).toEqual([]);
  });

  it(
    "AC-015 SPA の入口と application の起動の file は window・document に触れても lint が指摘せず、page の file に書いた同じ行は指摘する",
    () => {
      const readPathname = "export const pathname = window.location.pathname;";
      const readContainer =
        'export const container = document.getElementById("root");';

      expect(
        lintedLinesOf({
          "web/src/main.ts": `${readPathname}\n`,
          "web/src/app/public/entry.ts": `${readContainer}\n`,
          "web/src/landing/pages/Probe.ts": `${readPathname}\n${readContainer}\n`,
        }),
      ).toEqual({
        "web/src/main.ts": [],
        "web/src/app/public/entry.ts": [],
        "web/src/landing/pages/Probe.ts": [1, 2],
      });
    },
    LINT_TIMEOUT_MS,
  );
});

describe("#680 API の client", () => {
  it("AC-024 先読みした応答がある GET は、その応答を返して fetch を呼ばず、同じ要求の 2 回目は fetch を 1 回呼ぶ", async () => {
    const fetch = stubFetch([markedResponse(ME, "m1")]);
    vi.stubGlobal(
      "taimeiEarlyFetches",
      new Map([
        [
          "/api/me",
          Promise.resolve(markedResponse({ ...ME, name: "先読み" }, "m1")),
        ],
      ]),
    );
    const getMe = await startMeClient();

    const first = await getMe();
    const fetchCallsAfterFirst = fetch.mock.calls.length;
    const second = await getMe();

    expect({
      first: Exit.isSuccess(first) && first.value.name,
      fetchCallsAfterFirst,
      second: Exit.isSuccess(second) && second.value.name,
      fetchCallsAfterSecond: fetch.mock.calls.length,
    }).toEqual({
      first: "先読み",
      fetchCallsAfterFirst: 0,
      second: ME.name,
      fetchCallsAfterSecond: 1,
    });
  });

  it("AC-025 最初の応答の session の印が、後の要求の x-taimei-session に付く", async () => {
    const fetch = stubFetch([
      markedResponse(ME, "m1"),
      markedResponse(ME, "m1"),
    ]);
    const getMe = await startMeClient();

    await getMe();
    await getMe();

    expect(fetch.mock.calls.map(sessionMarkOf)).toEqual([null, "m1"]);
  });

  it("AC-026 応答の session の印が最初の応答と違うと、SessionChanged の失敗になる", async () => {
    stubFetch([markedResponse(ME, "m1"), markedResponse(ME, "m2")]);
    const getMe = await startMeClient();

    const first = await getMe();
    const second = await getMe();

    expect({
      first: Exit.isSuccess(first),
      second: failureTagOf(second),
    }).toEqual({ first: true, second: new SessionChanged()._tag });
  });

  it("AC-027 401 は Unauthenticated の失敗として届き、その間に document を離れない", async () => {
    const location = stubLocation();
    stubFetch([
      Response.json({ _tag: new Unauthenticated()._tag }, { status: 401 }),
    ]);
    const getMe = await startMeClient();

    const exit = await getMe();

    expect({
      failure: failureTagOf(exit),
      leaves: [location.assign, location.replace, location.reload].map(
        (leave) => leave.mock.calls.length,
      ),
    }).toEqual({
      failure: new Unauthenticated()._tag,
      leaves: [0, 0, 0],
    });
  });
});

const LEAVING_BY_HAND = `import { Effect } from "effect";
import { leaveSpaToSignIn } from "../../shared/leave-spa";

export const toSignIn = Effect.sync(leaveSpaToSignIn);
export const assign = Effect.sync(() => location.assign("/auth"));
export const reload = Effect.sync(() => location.reload());
`;

const LEAVE_SPA_MODULE = `export const leaveSpaToSignIn = () => location.assign("/auth");
export const reload = () => location.reload();
`;

describe("#680 document を離れる口", () => {
  it("AC-028 ログインへ移る口は、今の path と query を callbackUrl にした /auth へ document ごと移る", async () => {
    const location = stubLocation();
    const { leaveSpaToSignIn } = await import("../../shared/leave-spa");

    leaveSpaToSignIn();

    expect(location.assign).toHaveBeenCalledExactlyOnceWith(
      "/auth?callbackUrl=%2Fdashboard%2Fteams%3Ftab%3D1",
    );
  });

  it(
    "AC-029 page の file に書いた、document を離れる口の import と location.assign・location.reload の行は lint が指摘し、web/src/app/ の下の import と web/src/shared/leave-spa.ts の中の行は指摘しない",
    () => {
      expect(
        lintedLinesOf({
          "web/src/dashboard/pages/Probe.ts": LEAVING_BY_HAND,
          "web/src/app/dashboard/main.ts": LEAVING_BY_HAND,
          "web/src/shared/leave-spa.ts": LEAVE_SPA_MODULE,
        }),
      ).toEqual({
        "web/src/dashboard/pages/Probe.ts": [2, 5, 6],
        "web/src/app/dashboard/main.ts": [5, 6],
        "web/src/shared/leave-spa.ts": [],
      });
    },
    LINT_TIMEOUT_MS,
  );
});

const FALLBACK_MESSAGE = "チームを取得できませんでした";

describe("#680 失敗の文言と送信の状態", () => {
  it("AC-030 失敗から文言への写像は、契約の 8 つの失敗に今と同じ文言を返し、Unauthenticated・SessionChanged・型の無い失敗には渡した既定の文言を返す", async () => {
    const { failureMessageOf } = await import("../../shared/failure-message");

    expect(
      [
        new NotManager(),
        new TeamNotFound({ teamId: "t_1" }),
        new SkillNotFound(),
        new NotCompanyMember({ userId: "u_1" }),
        new InvalidName(),
        new DuplicateName(),
        new NotAssigned(),
        new InvalidLevel(),
      ].map((failure) =>
        failureMessageOf(Cause.fail(failure), FALLBACK_MESSAGE),
      ),
    ).toEqual([
      "管理者だけが操作できます",
      "チームが見つかりません",
      "スキルが見つかりません",
      "事業所のメンバーではありません",
      `名前は 1〜${NAME_MAX_LENGTH} 文字で入力してください`,
      "同じ名前がすでにあります",
      "チームに割り当てられた人だけが記入できます",
      "レベルの値が正しくありません",
    ]);
    expect(
      [
        Cause.fail(new Unauthenticated()),
        Cause.fail(new SessionChanged()),
        Cause.die(new Error("network")),
      ].map((cause) => failureMessageOf(cause, FALLBACK_MESSAGE)),
    ).toEqual([FALLBACK_MESSAGE, FALLBACK_MESSAGE, FALLBACK_MESSAGE]);
  });

  it("AC-031 送信の状態は Idle・Submitting・Rejected の 3 つで、Rejected は文言を持つ", async () => {
    const { Submission } = await import("../../shared/submission");

    expect([
      Submission.Idle(),
      Submission.Submitting(),
      Submission.Rejected({ message: "同じ名前がすでにあります" }),
    ]).toEqual([
      { _tag: "Idle" },
      { _tag: "Submitting" },
      { _tag: "Rejected", message: "同じ名前がすでにあります" },
    ]);
  });

  it("AC-032 web/src/shared/ の下に、API の client・document を離れる口・失敗の文言のそれぞれを import する試験が在る", () => {
    const testsImporting = (module: string) =>
      gitGrepLines(`from "(\\.\\./)+${module}"`, "web/src/shared").filter(
        (line) => line.split(":")[0]?.endsWith(".test.ts"),
      ).length > 0;

    expect({
      apiClient: testsImporting("spa-http-client"),
      leavingDocument: testsImporting("leave-spa"),
      failureMessage: testsImporting("failure-message"),
    }).toEqual({
      apiClient: true,
      leavingDocument: true,
      failureMessage: true,
    });
  });
});

const API_CLIENT_STUB = "export const SpaHttpClient = {};\n";

const API_CLIENT_OUTSIDE_FOLDKIT = `import { SpaHttpClient } from "../shared/spa-http-client";

export const client = SpaHttpClient;
`;

const API_CLIENT_AND_CAUSE_LOOKUP_IN_PAGE = `import { Cause } from "effect";
import { Command } from "foldkit";
import { SpaHttpClient } from "../../shared/spa-http-client";

export const define = Command.define;
export const client = SpaHttpClient;
export const errorOf = (cause: Cause.Cause<unknown>) => Cause.findErrorOption(cause);
`;

const CAUSE_LOOKUP = `import { Cause } from "effect";

export const errorOf = (cause: Cause.Cause<unknown>) => Cause.findErrorOption(cause);
`;

const EFFECT_HTTP_IN_PAGE = `import type { HttpClient } from "effect/http";

export type Client = HttpClient.HttpClient;
`;

describe("#680 lint", () => {
  it(
    "AC-033 Foldkit を import しない web の file に書いた API の client の import と、web/src/shared/failure-message.ts の外の Cause.findErrorOption の行は lint が指摘し、Foldkit の file の import と failure-message.ts の中の行は指摘しない",
    () => {
      expect(
        lintedLinesOf({
          "web/src/shared/spa-http-client.ts": API_CLIENT_STUB,
          "web/src/dashboard/client-probe.ts": API_CLIENT_OUTSIDE_FOLDKIT,
          "web/src/dashboard/pages/Probe.ts":
            API_CLIENT_AND_CAUSE_LOOKUP_IN_PAGE,
          "web/src/shared/failure-message.ts": CAUSE_LOOKUP,
        }),
      ).toEqual({
        "web/src/shared/spa-http-client.ts": [],
        "web/src/dashboard/client-probe.ts": [1],
        "web/src/dashboard/pages/Probe.ts": [7],
        "web/src/shared/failure-message.ts": [],
      });
    },
    LINT_TIMEOUT_MS,
  );

  it(
    "AC-034 effect/http の import は、page の file では今までどおり lint が指摘する",
    () => {
      expect(
        lintedLinesOf({
          "web/src/dashboard/pages/Probe.ts": EFFECT_HTTP_IN_PAGE,
        }),
      ).toEqual({ "web/src/dashboard/pages/Probe.ts": [1] });
    },
    LINT_TIMEOUT_MS,
  );
});
