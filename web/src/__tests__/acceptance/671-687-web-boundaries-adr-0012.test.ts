import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Effect, ManagedRuntime, Option } from "effect";
import { fromString } from "foldkit/url";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { SpaHttpClient } from "../../shared/spa-http-client";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");
const SLOW_TEST_TIMEOUT = 180_000;

const run = (cwd: string, command: string, ...args: readonly string[]) =>
  spawnSync(command, args, { cwd, encoding: "utf8" });

const gitLines = (args: readonly string[]) => {
  const result = run(REPO_ROOT, "git", ...args);
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git ${args.join(" ")}: ${result.stderr}`);
  }
  return result.stdout.split("\n").filter((line) => line !== "");
};

const gitGrepLines = (
  flags: readonly string[],
  pattern: string,
  ...pathspecs: readonly string[]
) =>
  gitLines([
    "grep",
    "--untracked",
    "-n",
    ...flags,
    "-E",
    pattern,
    "--",
    ...pathspecs,
  ]);

const readRepoFile = (file: string) =>
  readFileSync(path.join(REPO_ROOT, file), "utf8");

const temporaryDirs: string[] = [];
afterAll(() => {
  for (const dir of temporaryDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

const SKIPPED_IN_COPY = new Set([".git", "repos", "web", "node_modules"]);
const SKIPPED_IN_WEB_COPY = new Set(["dist", "tsconfig.tsbuildinfo"]);

const repoCopy = () => {
  const copy = mkdtempSync(path.join(tmpdir(), "taimei-671-687-"));
  temporaryDirs.push(copy);
  for (const entry of readdirSync(REPO_ROOT)) {
    if (SKIPPED_IN_COPY.has(entry)) {
      continue;
    }
    const source = path.join(REPO_ROOT, entry);
    const target = path.join(copy, entry);
    if (statSync(source).isFile()) {
      copyFileSync(source, target);
    } else {
      symlinkSync(source, target);
    }
  }
  cpSync(path.join(REPO_ROOT, "web"), path.join(copy, "web"), {
    recursive: true,
    filter: (source) => !SKIPPED_IN_WEB_COPY.has(path.basename(source)),
  });
  mkdirSync(path.join(copy, "node_modules"));
  for (const entry of readdirSync(path.join(REPO_ROOT, "node_modules"))) {
    if (entry !== ".cache") {
      symlinkSync(
        path.join(REPO_ROOT, "node_modules", entry),
        path.join(copy, "node_modules", entry),
      );
    }
  }
  return copy;
};

const writeInto = (copy: string, file: string, source: string) =>
  writeFileSync(path.join(copy, file), source);

const typecheckIn = (copy: string) => {
  const result = run(copy, "bun", "run", "typecheck");
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
  };
};

const ts6307LinesOf = (output: string, file: string) =>
  output
    .split("\n")
    .filter((line) => line.startsWith(file) && line.includes("TS6307"));

const crossDomainFixtures = [
  {
    file: "web/src/privacy/acceptance-fixture-privacy-to-dashboard.ts",
    source:
      'import { levelFromSelectValue } from "../dashboard/level";\nexport const fixture = levelFromSelectValue;\n',
  },
  {
    file: "web/src/dashboard/acceptance-fixture-dashboard-to-privacy.ts",
    source:
      'import * as facts from "../privacy/facts";\nexport const fixture = facts;\n',
  },
  {
    file: "web/src/landing/acceptance-fixture-landing-to-privacy.ts",
    source:
      'import * as facts from "../privacy/facts";\nexport const fixture = facts;\n',
  },
];

const sharedToDomainFixture = {
  file: "web/src/shared/acceptance-fixture-shared-to-dashboard.ts",
  source:
    'import { levelFromSelectValue } from "../dashboard/level";\nexport const fixture = levelFromSelectValue;\n',
};

describe("#671 web の domain の境界の型", () => {
  let violations: ReturnType<typeof typecheckIn> | undefined;
  const typecheckWithViolations = () => {
    if (violations === undefined) {
      const copy = repoCopy();
      for (const fixture of [...crossDomainFixtures, sharedToDomainFixture]) {
        writeInto(copy, fixture.file, fixture.source);
      }
      violations = typecheckIn(copy);
    }
    return violations;
  };

  it.each(crossDomainFixtures)(
    "AC-001 domain の file が別の domain の file を import すると、bun run typecheck がその file の TS6307 を出して落ちる ($file)",
    ({ file }) => {
      const result = typecheckWithViolations();

      expect(result.status).not.toBe(0);
      expect(ts6307LinesOf(result.output, file)).not.toEqual([]);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "AC-002 shared の file が domain の file を import すると、bun run typecheck がその file の TS6307 を出して落ちる",
    () => {
      const result = typecheckWithViolations();

      expect(result.status).not.toBe(0);
      expect(
        ts6307LinesOf(result.output, sharedToDomainFixture.file),
      ).not.toEqual([]);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "AC-003 domain の file から shared と契約を import する file を足しても、bun run typecheck は通る",
    () => {
      const copy = repoCopy();
      writeInto(
        copy,
        "web/src/dashboard/acceptance-fixture-dashboard-to-shared.ts",
        'import { SESSION_HEADER } from "../../../src/spa-contract";\nimport * as submission from "../shared/submission";\nexport const fixture = { SESSION_HEADER, submission };\n',
      );

      const result = typecheckIn(copy);

      expect(result.output).not.toContain("error TS");
      expect(result.status).toBe(0);
    },
    SLOW_TEST_TIMEOUT,
  );

  it(
    "AC-005 vitest の web の project は、web/src の .test.tsx を拾わず、同じ所の .test.ts を拾う",
    () => {
      const copy = repoCopy();
      const testSource = 'it("fixture", () => {});\n';
      writeInto(copy, "web/src/acceptance-fixture.test.tsx", testSource);
      writeInto(copy, "web/src/acceptance-fixture.test.ts", testSource);

      const result = run(
        copy,
        "bunx",
        "vitest",
        "list",
        "--project",
        "web",
        "--filesOnly",
      );
      const output = `${result.stdout}${result.stderr}`;

      expect({
        tsx: output.includes("acceptance-fixture.test.tsx"),
        ts: output.includes("acceptance-fixture.test.ts"),
      }).toEqual({ tsx: false, ts: true });
    },
    SLOW_TEST_TIMEOUT,
  );
});

const ADR_DIR = "docs/adr";
const adrFileNumbered = (number: string) =>
  readdirSync(path.join(REPO_ROOT, ADR_DIR)).filter(
    (file) => file.startsWith(`${number}-`) && file.endsWith(".md"),
  );
const adr0012 = () => {
  const [file] = adrFileNumbered("0012");
  return file === undefined ? "" : readRepoFile(path.join(ADR_DIR, file));
};

describe("#687 ADR-0012", () => {
  it("AC-006 docs/adr に番号 0012 の ADR が在る", () => {
    expect(adrFileNumbered("0012")).toHaveLength(1);
  });

  it.each(["0006", "0007"])(
    "AC-007 ADR-%s は ADR-0012 を名指しする",
    (number) => {
      const [file] = adrFileNumbered(number);

      expect(
        file === undefined
          ? ""
          : readRepoFile(path.join(ADR_DIR, file)).includes("ADR-0012"),
      ).toBe(true);
    },
  );

  it("AC-008 ADR-0012 は、移行の前の JS の大きさと、移行の後の公開ページが読む JS と合計を、圧縮前と gzip で書く", () => {
    const adr = adr0012();

    expect({
      before: adr.includes("588,978"),
      beforeGzip: adr.includes("190,766"),
      uncompressed: adr.includes("圧縮前"),
      gzip: adr.includes("gzip"),
      publicPages: adr.includes("公開ページ"),
      total: adr.includes("合計"),
    }).toEqual({
      before: true,
      beforeGzip: true,
      uncompressed: true,
      gzip: true,
      publicPages: true,
      total: true,
    });
  });

  it("AC-009 ADR-0012 は taimei-auth の ADR-0023 を名指しし、application の分け方・prerender・cache・oxlint を話題にする", () => {
    const adr = adr0012();

    expect({
      foldkitChoice: adr.includes("taimei-auth") && adr.includes("ADR-0023"),
      applications: adr.includes("application"),
      prerender: adr.includes("prerender"),
      cache: adr.includes("cache"),
      oxlint: adr.includes("oxlint"),
    }).toEqual({
      foldkitChoice: true,
      applications: true,
      prerender: true,
      cache: true,
      oxlint: true,
    });
  });
});

const WEB_INSTRUCTIONS = "web/src/CLAUDE.md";

describe("#687 web/src/CLAUDE.md", () => {
  it("AC-010 web/src/CLAUDE.md に code の block と Foldkit の module の名前を書かない", () => {
    expect(
      gitGrepLines(
        [],
        "```|(^|[^/a-z])(@foldkit/|foldkit/[a-z])",
        WEB_INSTRUCTIONS,
      ),
    ).toEqual([]);
  });

  it("AC-011 web/src/CLAUDE.md は、Foldkit の code を書く時に .claude/skills/ の skill を読むよう指す", () => {
    const instructions = readRepoFile(WEB_INSTRUCTIONS);

    expect({
      foldkit: instructions.includes("Foldkit"),
      skillsDir: instructions.includes(".claude/skills/"),
      skill: instructions.includes("skill"),
    }).toEqual({ foldkit: true, skillsDir: true, skill: true });
  });
});

const DOM_ADOPTING_START = ["hyd", "rat"].join("");

describe("#687 e2e の記述", () => {
  it("AC-012 e2e/tests の spec に React・TanStack・Router の名前を書かない", () => {
    expect(gitGrepLines(["-i"], "react|tanstack|router", "e2e/tests")).toEqual(
      [],
    );
  });

  it("AC-014 e2e/README.md に、描画済みの DOM を引き継いで起動する語を書かない", () => {
    expect(gitGrepLines(["-i"], DOM_ADOPTING_START, "e2e/README.md")).toEqual(
      [],
    );
  });
});

const ORIGIN = "https://app.example.com";
const TEAM_ID = "00000000-0000-4000-8000-0000000000aa";
const API_REPLIES: Readonly<Record<string, unknown>> = {
  "/api/me": { userId: "u_1", name: "山田 花子", canManage: true },
  "/api/teams": { teams: [{ id: TEAM_ID, name: "開発" }] },
  [`/api/teams/${TEAM_ID}`]: {
    team: {
      id: TEAM_ID,
      name: "開発",
      skills: [],
      assignedUserIds: [],
      levels: [],
    },
    members: [],
  },
  "/api/members": {
    members: [
      { name: "山田 花子", email: "hanako@example.com", role: "OWNER" },
    ],
  },
};

const replyOf = (apiPath: string) => {
  const body = API_REPLIES[apiPath];
  return body === undefined
    ? Promise.reject(new Error(`応答を決めていない path: ${apiPath}`))
    : Promise.resolve(Response.json(body));
};

const earlyFetchScript = () => {
  const scripts = [
    ...readRepoFile("web/index.html").matchAll(/<script>([\s\S]*?)<\/script>/g),
  ]
    .map(([, body]) => body ?? "")
    .filter((body) => body.includes("taimeiEarlyFetches"));
  if (scripts.length !== 1) {
    throw new Error("web/index.html に先読みの script が 1 つではない");
  }
  return scripts[0] ?? "";
};

const runEarlyFetchScript = (pathname: string) => {
  const earlyPaths: string[] = [];
  const window: { taimeiEarlyFetches?: Map<string, Promise<Response>> } = {};
  new Function("location", "fetch", "window", earlyFetchScript())(
    { pathname },
    (url: string) => {
      earlyPaths.push(url);
      return replyOf(url);
    },
    window,
  );
  return { earlyPaths, earlyFetches: window.taimeiEarlyFetches };
};

type Step<Model, Message, Resources> = Readonly<{
  model: Model;
  commands?: ReadonlyArray<
    Readonly<{ effect: Effect.Effect<Message, never, Resources> }>
  >;
}>;

const driveUntilIdle = async <Model, Message, Resources>(
  update: (model: Model, message: Message) => Step<Model, Message, Resources>,
  runEffect: (
    effect: Effect.Effect<Message, never, Resources>,
  ) => Promise<Message>,
  opened: Step<Model, Message, Resources>,
  listenUrlChange: (changed: (message: Message) => void) => void,
) => {
  let current = opened.model;
  const running = new Set<Promise<void>>();
  const apply = (step: Step<Model, Message, Resources>) => {
    current = step.model;
    for (const command of step.commands ?? []) {
      const done = runEffect(command.effect).then((message) => {
        apply(update(current, message));
      });
      running.add(done);
      void done.finally(() => running.delete(done));
    }
  };
  listenUrlChange((message) => apply(update(current, message)));
  apply(opened);
  while (running.size > 0) {
    await Promise.all(running);
  }
};

const FOLDKIT_URL_CHANGE_EVENT = "foldkit:urlchange";

const stubBrowser = (pathname: string) => {
  const location = {
    href: `${ORIGIN}${pathname}`,
    origin: ORIGIN,
    pathname,
    search: "",
    assign: vi.fn(),
    reload: vi.fn(),
  };
  const moveTo = (_state: unknown, _title: string, url: string | URL) => {
    const next = new URL(String(url), ORIGIN);
    location.href = next.href;
    location.pathname = next.pathname;
    location.search = next.search;
  };
  const history = { pushState: vi.fn(moveTo), replaceState: vi.fn(moveTo) };
  const scrollTo = vi.fn();
  const urlChangeListeners: Array<(href: string) => void> = [];
  vi.stubGlobal("window", {
    location,
    history,
    scrollTo,
    dispatchEvent: (event: Event) => {
      if (event.type === FOLDKIT_URL_CHANGE_EVENT) {
        for (const listener of urlChangeListeners) {
          listener(location.href);
        }
      }
      return true;
    },
  });
  vi.stubGlobal("location", location);
  vi.stubGlobal("history", history);
  vi.stubGlobal("scrollTo", scrollTo);
  return {
    onUrlChange: (listener: (href: string) => void) => {
      urlChangeListeners.push(listener);
    },
  };
};

const urlOf = (href: string) => Option.getOrThrow(fromString(href));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("#687 web/index.html の先読みと application dashboard の要求", () => {
  it.each([
    "/dashboard",
    "/dashboard/teams",
    `/dashboard/teams/${TEAM_ID}`,
    "/dashboard/members",
  ])(
    "AC-015 %s を開くと、先読みした fetch はすべて使われ、先読みの外の GET は 0 件である",
    async (pathname) => {
      const { earlyPaths, earlyFetches } = runEarlyFetchScript(pathname);
      vi.stubGlobal("taimeiEarlyFetches", earlyFetches);
      const extraGetPaths: string[] = [];
      vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
        const apiPath = new URL(input instanceof Request ? input.url : input)
          .pathname;
        if ((init?.method ?? "GET") === "GET") {
          extraGetPaths.push(apiPath);
        }
        return replyOf(apiPath);
      });
      const browser = stubBrowser(pathname);
      const application = await import("../../app/dashboard/main");
      const runtime = ManagedRuntime.make(SpaHttpClient.layer(ORIGIN));

      await driveUntilIdle(
        application.update,
        (effect) => runtime.runPromise(effect),
        application.init(urlOf(`${ORIGIN}${pathname}`)),
        (changed) =>
          browser.onUrlChange((href) =>
            changed(application.Message.ChangedUrl({ url: urlOf(href) })),
          ),
      );

      expect({
        early: earlyPaths.length > 0,
        unused: [...(earlyFetches?.keys() ?? [])],
        extra: extraGetPaths,
      }).toEqual({ early: true, unused: [], extra: [] });
    },
  );
});
