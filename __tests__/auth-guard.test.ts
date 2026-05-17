import { cookies } from "next/headers";
import { redirect } from "next/navigation";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const mockGetSession = vi.fn();

// SDK 1.0.0 (ADR-001 R2) で createAuthGuard().getSession() の戻り型が VerifyResult に変更:
//   { ok: true; data: SessionData } | { ok: false; reason: Result }
// auth-guard.ts の thin wrap で { result.ok ? result.data : null } に変換する形を維持。
vi.mock("@taimei-code/auth-client", () => ({
  createAuthClient: () => ({
    authService: { verifySession: vi.fn() },
    userService: {},
  }),
  createAuthGuard: () => ({
    getSession: mockGetSession,
  }),
  createServiceKeyInterceptor: vi.fn(() => () => ({})),
  getSessionToken: vi.fn(),
  Result: { UNSPECIFIED: 0, SESSION_NOT_FOUND: 2 },
}));

vi.mock("@connectrpc/connect-node", () => ({
  createConnectTransport: vi.fn(() => ({})),
}));

const mockSessionData = {
  user: {
    id: "user-id",
    name: "Test User",
    email: "test@example.com",
    emailVerified: true,
    image: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
  },
  session: {
    id: "session-id",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    kind: "user",
  },
};

describe("auth-guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "test-token" }),
    } as any);
  });

  describe("requireSession (consumer wrapper)", () => {
    test("未認証の場合、/auth へリダイレクト", async () => {
      mockGetSession.mockResolvedValue({ ok: false, reason: 2 });

      const { requireSession } = await import("@/app/lib/auth-guard");
      await requireSession({ returnTo: "/dashboard" });

      expect(redirect).toHaveBeenCalledWith("/auth?callbackUrl=%2Fdashboard");
    });

    test("認証済みの場合、セッションを返す", async () => {
      mockGetSession.mockResolvedValue({ ok: true, data: mockSessionData });

      const { requireSession } = await import("@/app/lib/auth-guard");
      const result = await requireSession({ returnTo: "/dashboard" });

      expect(redirect).not.toHaveBeenCalled();
      expect(result).toEqual(mockSessionData);
    });
  });

  describe("getSession", () => {
    test("未認証の場合、null を返す（リダイレクトなし）", async () => {
      mockGetSession.mockResolvedValue({ ok: false, reason: 2 });

      const { getSession } = await import("@/app/lib/auth-guard");
      const result = await getSession();

      expect(redirect).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    test("認証済みの場合、セッションを返す", async () => {
      mockGetSession.mockResolvedValue({ ok: true, data: mockSessionData });

      const { getSession } = await import("@/app/lib/auth-guard");
      const result = await getSession();

      expect(result).toEqual(mockSessionData);
    });
  });
});
