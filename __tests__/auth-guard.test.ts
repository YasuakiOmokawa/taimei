import { cookies } from "next/headers";
import { redirect } from "next/navigation";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const mockGetSession = vi.fn();

// SDK 1.0.0 で createAuthGuard().getSession() の戻り型が VerifyResult に変更:
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

  describe("requireCompany の公開前のゲート", () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    test("ALLOWED_COMPANY_IDS に無い事業所は /unavailable へ送る", async () => {
      mockGetSession.mockResolvedValue({
        ok: true,
        data: { ...mockSessionData, companyId: "cmp_c" },
      });
      vi.stubEnv("ALLOWED_COMPANY_IDS", "cmp_a");

      const { requireCompany } = await import("@/app/lib/auth-guard");
      await requireCompany({ returnTo: "/dashboard/teams" });

      expect(redirect).toHaveBeenCalledWith("/unavailable");
    });

    test("ALLOWED_COMPANY_IDS が * なら、どの事業所も通す", async () => {
      mockGetSession.mockResolvedValue({
        ok: true,
        data: { ...mockSessionData, companyId: "cmp_c" },
      });
      vi.stubEnv("ALLOWED_COMPANY_IDS", "*");

      const { requireCompany } = await import("@/app/lib/auth-guard");
      const result = await requireCompany({ returnTo: "/dashboard/teams" });

      expect(redirect).not.toHaveBeenCalled();
      expect(result.companyId).toBe("cmp_c");
    });

    test("事業所の無い人は、ゲートより先に事業所登録へ送る", async () => {
      mockGetSession.mockResolvedValue({ ok: true, data: mockSessionData });
      vi.stubEnv("ALLOWED_COMPANY_IDS", undefined);

      const { requireCompany } = await import("@/app/lib/auth-guard");
      await requireCompany({ returnTo: "/dashboard/teams" });

      const firstRedirect = String(vi.mocked(redirect).mock.calls[0]?.[0]);
      expect(firstRedirect).toContain("/auth/signup/company");
    });
  });

  test("inviteMembersUrl は受諾で現在の事業所が招待先に替わるので、受諾後の遷移先を /dashboard にする", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_URL", "http://auth.taimei-code.local:3100");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://app.taimei-code.local:3001");
    const { inviteMembersUrl } = await import("@/app/lib/auth-guard");
    const url = new URL(inviteMembersUrl());
    vi.unstubAllEnvs();

    expect(url.origin).toBe("http://auth.taimei-code.local:3100");
    expect(url.pathname).toBe("/account/members");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      service_name: "taimei",
      redirect_url: "http://app.taimei-code.local:3001/dashboard",
    });
  });
});
