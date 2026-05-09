import { cookies } from "next/headers";
import { redirect } from "next/navigation";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

const mockVerifySession = vi.fn();
const mockGetSession = vi.fn();

vi.mock("@taimei-code/auth-client", () => ({
  createAuthClient: () => ({
    authService: { verifySession: vi.fn() },
    userService: {},
  }),
  createAuthGuard: () => ({
    verifySession: mockVerifySession,
    getSession: mockGetSession,
  }),
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
    token: "test-token",
    expiresAt: new Date(Date.now() + 86400000).toISOString(),
    userId: "user-id",
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

  describe("verifySession", () => {
    test("未認証の場合、/auth へリダイレクト", async () => {
      mockVerifySession.mockImplementation(() => {
        redirect("/auth?callbackUrl=%2Fdashboard");
      });

      const { verifySession } = await import("@/app/lib/auth-guard");
      await verifySession();

      expect(redirect).toHaveBeenCalledWith("/auth?callbackUrl=%2Fdashboard");
    });

    test("認証済みの場合、セッションを返す", async () => {
      mockVerifySession.mockResolvedValue(mockSession);

      const { verifySession } = await import("@/app/lib/auth-guard");
      const result = await verifySession();

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
