import { Exit, ManagedRuntime, Option } from "effect";
import { afterEach, expect, it, vi } from "vitest";
import { SESSION_HEADER } from "../../../../src/spa-contract";
import { SpaHttpClient } from "../spa-http-client";

const ORIGIN = "http://app.example";
const ME = { userId: "u_1", name: "山田", canManage: false };
const TEAMS = { teams: [] };

afterEach(() => {
  vi.unstubAllGlobals();
});

const markedResponse = (body: unknown, mark: string) =>
  Response.json(body, { headers: { [SESSION_HEADER]: mark } });

const stubFetch = (respond: () => Response) => {
  const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    respond(),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

const startClient = () => ManagedRuntime.make(SpaHttpClient.layer(ORIGIN));

const getMe = (runtime: ReturnType<typeof startClient>) =>
  runtime.runPromiseExit(SpaHttpClient.use((client) => client.me.get()));

const failureTagOf = <A, E extends { readonly _tag: string }>(
  exit: Exit.Exit<A, E>,
) =>
  Option.getOrUndefined(
    Option.map(Exit.findErrorOption(exit), ({ _tag }) => _tag),
  );

it("先読みがあっても、同じ path への GET でない要求は fetch し、先読みを残す", async () => {
  const fetch = stubFetch(() => Response.json({ id: "t_1" }));
  const earlyFetches = new Map([
    ["/api/teams", Promise.resolve(Response.json(TEAMS))],
  ]);
  vi.stubGlobal("taimeiEarlyFetches", earlyFetches);

  const created = await startClient().runPromiseExit(
    SpaHttpClient.use((client) =>
      client.teamManagement.create({ payload: { name: "開発" } }),
    ),
  );

  expect({
    created: Exit.isSuccess(created),
    fetchCalls: fetch.mock.calls.length,
    earlyFetchesLeft: [...earlyFetches.keys()],
  }).toEqual({
    created: true,
    fetchCalls: 1,
    earlyFetchesLeft: ["/api/teams"],
  });
});

it("先読みの応答の印も最初の印として覚え、後の応答の印が違うと SessionChanged の失敗になる", async () => {
  stubFetch(() => markedResponse(ME, "m2"));
  vi.stubGlobal(
    "taimeiEarlyFetches",
    new Map([["/api/me", Promise.resolve(markedResponse(ME, "m1"))]]),
  );
  const runtime = startClient();

  const early = await getMe(runtime);
  const fetched = await getMe(runtime);

  expect({
    early: Exit.isSuccess(early),
    fetched: failureTagOf(fetched),
  }).toEqual({ early: true, fetched: "SessionChanged" });
});

it("印の無い応答は、失敗にせず、印として覚えない", async () => {
  const responses = [
    Response.json(ME),
    markedResponse(ME, "m1"),
    markedResponse(ME, "m1"),
  ];
  const fetch = stubFetch(() => responses.shift() ?? Response.error());
  const runtime = startClient();

  const exits = [
    await getMe(runtime),
    await getMe(runtime),
    await getMe(runtime),
  ];

  expect({
    succeeded: exits.map(Exit.isSuccess),
    sentMarks: fetch.mock.calls.map(([input, init]) =>
      new Request(input, init).headers.get(SESSION_HEADER),
    ),
  }).toEqual({
    succeeded: [true, true, true],
    sentMarks: [null, null, "m1"],
  });
});

it("client を組み直すと (別の document)、前の印を持ち越さない", async () => {
  const marks = ["m1", "m2"];
  stubFetch(() => markedResponse(ME, marks.shift() ?? "m3"));

  const inFirstDocument = await getMe(startClient());
  const inSecondDocument = await getMe(startClient());

  expect([inFirstDocument, inSecondDocument].map(Exit.isSuccess)).toEqual([
    true,
    true,
  ]);
});
