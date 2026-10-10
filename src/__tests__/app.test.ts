import { buildAuthLoginUrl } from "@taimei-code/auth-client";
import { Effect, Schema } from "effect";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { teams } from "@/db/drizzle/schema";
import { CompanyId } from "@/db/ids";
import { withRollbackDb } from "@/src/services/__tests__/db/test-db";
import { TeamNotFound } from "@/src/services/team-errors";
import { app, type Env } from "../app";
import { runJson, type SessionVariables } from "../run-json";

vi.mock("@/db/drizzle/client", async () => ({
  db: (await import("@/src/services/__tests__/db/test-db")).dbInRollback,
}));

const ORIGIN = "http://app.example";
const AUTH_URL = "https://auth.example";
const COOKIE = { Cookie: "better-auth.session_token=tok" };

type SessionOptions = {
  companyId?: string;
  role?: "ROLE_OWNER" | "ROLE_ADMIN" | "ROLE_MEMBER";
  createdAt?: string;
};

const sessionOk = ({
  companyId = "cmp_app_a",
  role,
  createdAt = "2026-10-10T00:00:00.000Z",
}: SessionOptions = {}) =>
  Response.json({
    ok: {
      user: {
        id: "u_1",
        name: "山田 花子",
        email: "hanako@example.com",
        emailVerified: true,
        createdAt,
        updatedAt: createdAt,
        defaultCompanyId: companyId || undefined,
      },
      session: { id: "s_1", expiresAt: "2099-01-01T00:00:00.000Z" },
      currentRole: role,
    },
  });

const sessionError = () =>
  Response.json({ error: { reason: "RESULT_SESSION_NOT_FOUND" } });

let binding: ReturnType<typeof vi.fn<typeof fetch>>;
const envWith = (response: () => Response | Promise<Response>): Env => {
  binding = vi.fn<typeof fetch>(async () => response());
  return {
    AUTH: { fetch: binding },
    AUTH_URL,
    HYPERDRIVE: { connectionString: "unused" },
  };
};

const get = (path: string, env: Env, headers: HeadersInit = COOKIE) =>
  app.request(`${ORIGIN}${path}`, { headers }, env);

const locationOf = (response: Response) =>
  new URL(response.headers.get("Location") ?? "");

let consoleError: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("/api の session", () => {
  it("cookie が無ければ 401 で、taimei-auth を呼ばない", async () => {
    const env = envWith(sessionOk);

    const response = await get("/api/teams", env, {});

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ _tag: "Unauthenticated" });
    expect(binding).not.toHaveBeenCalled();
  });

  it("事業所の無い session は 401", async () => {
    const response = await get(
      "/api/teams",
      envWith(() => sessionOk({ companyId: "" })),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ _tag: "Unauthenticated" });
  });

  it("taimei-auth が session の失敗を返すと 401", async () => {
    const response = await get("/api/teams", envWith(sessionError));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ _tag: "Unauthenticated" });
  });

  it("taimei-auth に届かないと 401 で、1 回報告する", async () => {
    const response = await get(
      "/api/teams",
      envWith(() => {
        throw new Error("connection refused");
      }),
    );

    expect(response.status).toBe(401);
    expect(consoleError).toHaveBeenCalledOnce();
  });
});

describe("GET /api/teams", () => {
  it("session の事業所のチームだけを id と name で返す", () =>
    withRollbackDb(async (tx) => {
      const [a] = await tx
        .insert(teams)
        .values({ companyId: CompanyId.make("cmp_app_a"), name: "A のチーム" })
        .returning();
      await tx
        .insert(teams)
        .values({ companyId: CompanyId.make("cmp_app_b"), name: "B のチーム" });

      const response = await get(
        "/api/teams",
        envWith(() => sessionOk({ role: "ROLE_OWNER" })),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        teams: [{ id: a.id, name: "A のチーム" }],
      });
    }));
});

describe("GET /api/me", () => {
  it.each([
    ["ROLE_ADMIN", true],
    ["ROLE_MEMBER", false],
    [undefined, false],
  ] as const)(
    "role %s の canManage は %s で、名前と canManage だけを返す",
    async (role, canManage) => {
      const response = await get(
        "/api/me",
        envWith(() => sessionOk({ role })),
      );

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ name: "山田 花子", canManage });
    },
  );
});

describe("CSRF と CORS", () => {
  it("別の origin の form の POST は 403", async () => {
    const response = await app.request(
      `${ORIGIN}/api/teams`,
      {
        method: "POST",
        headers: {
          ...COOKIE,
          Origin: "https://evil.example",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "name=x",
      },
      envWith(sessionOk),
    );

    expect(response.status).toBe(403);
  });

  it("別の origin の GET にも Access-Control-Allow-Origin を付けない", async () => {
    const response = await get("/api/me", envWith(sessionOk), {
      ...COOKIE,
      Origin: "https://evil.example",
    });

    expect(response.status).toBe(200);
    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false);
  });
});

describe("/auth の着地", () => {
  const login = (callbackUrl?: string) => {
    const afterSignIn = new URL("/auth/after-signin", ORIGIN);
    if (callbackUrl) afterSignIn.searchParams.set("callbackUrl", callbackUrl);
    return buildAuthLoginUrl({
      authBaseUrl: AUTH_URL,
      service: "taimei",
      returnTo: afterSignIn.toString(),
      signUpUrl: `${ORIGIN}/auth/after-signup`,
    });
  };

  it("/auth は taimei-auth のログインへ", async () => {
    const response = await get("/auth", envWith(sessionOk));

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(login());
  });

  it("/auth の callbackUrl はログイン後の着地に渡す", async () => {
    const response = await get(
      "/auth?callbackUrl=/dashboard/teams",
      envWith(sessionOk),
    );

    expect(locationOf(response).searchParams.get("redirect_url")).toBe(
      `${ORIGIN}/auth/after-signin?callbackUrl=%2Fdashboard%2Fteams`,
    );
  });

  it.each(["https://evil.example/x", "//evil.example/x"])(
    "別の origin の callbackUrl %s は捨てる",
    async (callbackUrl) => {
      const response = await get(
        `/auth?callbackUrl=${encodeURIComponent(callbackUrl)}`,
        envWith(sessionOk),
      );

      expect(response.headers.get("Location")).toBe(login());
    },
  );

  it.each(["/.//evil.example/x", "/a/..//evil.example/x"])(
    "正規化すると // で始まる callbackUrl %s の after-signin は別の origin へ移さない",
    async (callbackUrl) => {
      const response = await get(
        `/auth/after-signin?callbackUrl=${encodeURIComponent(callbackUrl)}`,
        envWith(sessionOk),
      );

      expect(response.headers.get("Location")).toBe(`${ORIGIN}/dashboard`);
    },
  );

  it("session の無い after-signin は signin_failed", async () => {
    const response = await get("/auth/after-signin", envWith(sessionError));

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      `${AUTH_URL}/auth/error?reason=signin_failed`,
    );
  });

  it("事業所の無い after-signin は事業所の登録へ", async () => {
    const response = await get(
      "/auth/after-signin?callbackUrl=/dashboard/teams",
      envWith(() => sessionOk({ companyId: "" })),
    );

    const location = locationOf(response);
    expect(response.status).toBe(302);
    expect(location.origin + location.pathname).toBe(
      `${AUTH_URL}/auth/signup/company`,
    );
    expect(location.searchParams.get("service_name")).toBe("taimei");
    expect(location.searchParams.get("redirect_url")).toBe(
      `${ORIGIN}/dashboard/teams`,
    );
  });

  it("事業所のある after-signin は callbackUrl へ", async () => {
    const response = await get(
      "/auth/after-signin?callbackUrl=/dashboard/teams",
      envWith(sessionOk),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(`${ORIGIN}/dashboard/teams`);
  });

  it("callbackUrl の無い after-signin は /dashboard へ", async () => {
    const response = await get("/auth/after-signin", envWith(sessionOk));

    expect(response.headers.get("Location")).toBe(`${ORIGIN}/dashboard`);
  });

  it("session の無い after-signup は signin_failed", async () => {
    const response = await get("/auth/after-signup", envWith(sessionError));

    expect(response.headers.get("Location")).toBe(
      `${AUTH_URL}/auth/error?reason=signin_failed`,
    );
  });

  it("createdAt が日時でない after-signup は signin_failed", async () => {
    const response = await get(
      "/auth/after-signup",
      envWith(() => sessionOk({ createdAt: "not a date" })),
    );

    expect(response.headers.get("Location")).toBe(
      `${AUTH_URL}/auth/error?reason=signin_failed`,
    );
  });

  const createdAt = "2026-10-10T00:00:00.000Z";
  const fiveMinutes = 5 * 60 * 1000;

  it("ちょうど 5 分前に作られた user の after-signup は signup_already_completed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse(createdAt) + fiveMinutes);

    const response = await get(
      "/auth/after-signup",
      envWith(() => sessionOk({ createdAt })),
    );

    expect(response.headers.get("Location")).toBe(
      `${AUTH_URL}/auth/error?reason=signup_already_completed`,
    );
  });

  it("5 分前より 1 ms 新しい user の after-signup は /dashboard へ", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.parse(createdAt) + fiveMinutes - 1);

    const response = await get(
      "/auth/after-signup",
      envWith(() => sessionOk({ createdAt })),
    );

    expect(response.headers.get("Location")).toBe(`${ORIGIN}/dashboard`);
  });

  it("/auth/account は taimei-auth の /account へ", async () => {
    const response = await get("/auth/account", envWith(sessionOk));

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(`${AUTH_URL}/account`);
  });
});

describe("runJson", () => {
  const session = {
    companyId: CompanyId.make("cmp_app_a"),
    userId: "u_1",
    userName: "山田 花子",
    role: "OWNER" as const,
  };
  const withSession = () =>
    new Hono<SessionVariables>().use((c, next) => {
      c.set("session", session);
      return next();
    });

  it("失敗は表の状態コードと文言で返す", () =>
    withRollbackDb(async () => {
      const response = await withSession()
        .get("/x", (c) =>
          runJson(c, Schema.Struct({}), () =>
            Effect.fail(new TeamNotFound({ teamId: "t" })),
          ),
        )
        .request("/x");

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        _tag: "TeamNotFound",
        message: "チームが見つかりません",
      });
    }));

  it("成功は schema に無い key を落として返す", () =>
    withRollbackDb(async () => {
      const response = await withSession()
        .get("/x", (c) =>
          runJson(c, Schema.Struct({ id: Schema.String }), () =>
            Effect.succeed({ id: "t", email: "leak@example.com" }),
          ),
        )
        .request("/x");

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ id: "t" });
    }));
});
