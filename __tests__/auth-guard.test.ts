import { cookies } from "next/headers";
import { redirect } from "next/navigation";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const mockGetSession = vi.fn();

// SDK 0.5.0 (ADR-007) で createAuthGuard 戻り値は { getSession } のみ。
// requireSession は consumer 側 wrapper (`app/lib/auth-guard.ts`) で実装するため
// mock せず実装ごとテストする (session の有無で redirect が呼ばれることを assert)。
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
}));

vi.mock("@connectrpc/connect-node", () => ({
  createConnectTransport: vi.fn(() => ({})),
}));

const mockSession = {
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
      mockGetSession.mockResolvedValue(null);

      const { requireSession } = await import("@/app/lib/auth-guard");
      await requireSession({ returnTo: "/dashboard" });

      expect(redirect).toHaveBeenCalledWith("/auth?callbackUrl=%2Fdashboard");
    });

    test("認証済みの場合、セッションを返す", async () => {
      mockGetSession.mockResolvedValue(mockSession);

      const { requireSession } = await import("@/app/lib/auth-guard");
      const result = await requireSession({ returnTo: "/dashboard" });

      expect(redirect).not.toHaveBeenCalled();
      expect(result).toEqual(mockSession);
    });
  });

  describe("getSession", () => {
    test("未認証の場合、null を返す（リダイレクトなし）", async () => {
      mockGetSession.mockResolvedValue(null);

      const { getSession } = await import("@/app/lib/auth-guard");
      const result = await getSession();

      expect(redirect).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    test("認証済みの場合、セッションを返す", async () => {
      mockGetSession.mockResolvedValue(mockSession);

      const { getSession } = await import("@/app/lib/auth-guard");
      const result = await getSession();

      expect(result).toEqual(mockSession);
    });
  });
});
