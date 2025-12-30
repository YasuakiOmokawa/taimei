import { describe, it, expect } from "vitest";
import { Effect, Either } from "effect";
import type { Session } from "@/lib/auth";
import { AuthService } from "../auth-service";
import { MagicLinkError, SignOutError } from "../auth-errors";
import { AuthRepositoryError } from "../auth-repository";

// Layer DI を利用したモック実装
// テストでは providerId のみ使用するため、必要最小限の型定義
type MockAccount = { providerId: string } | undefined;

const createMockAuthService = (options: {
  session?: Session | null;
  signOutError?: boolean;
  magicLinkError?: boolean;
  accountQueryError?: boolean;
  account?: MockAccount;
} = {}) =>
  new AuthService({
    getSession: () => Effect.succeed(options.session ?? null),

    signOut: () =>
      options.signOutError
        ? Effect.fail(new SignOutError({ cause: new Error("Sign out failed") }))
        : Effect.succeed(undefined as void),

    sendMagicLink: (_email: string, _callbackURL: string) =>
      options.magicLinkError
        ? Effect.fail(new MagicLinkError({ cause: new Error("Magic link failed") }))
        : Effect.succeed(undefined as void),

    findAccountByUserId: (_userId: string) =>
      options.accountQueryError
        ? Effect.fail(
            new AuthRepositoryError({ message: "Account query failed" })
          )
        : Effect.succeed(options.account ?? undefined),
  });

const runWithMock = <A, E>(
  effect: Effect.Effect<A, E, AuthService>,
  mock: AuthService
) =>
  effect.pipe(
    Effect.provideService(AuthService, mock),
    Effect.either,
    Effect.runPromise
  );

describe("AuthService", () => {
  describe("getSession", () => {
    it("正常系: セッションが存在する場合、セッションを返す", async () => {
      const mockSession = {
        session: {
          id: "session-1",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId: "user-1",
          expiresAt: new Date(Date.now() + 3600000),
          token: "test-token",
        },
        user: {
          id: "user-1",
          name: "Test User",
          email: "test@example.com",
          emailVerified: true,
          image: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      } as Session;

      const mock = createMockAuthService({ session: mockSession });

      const result = await runWithMock(
        Effect.gen(function* () {
          const service = yield* AuthService;
          return yield* service.getSession();
        }),
        mock
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toEqual(mockSession);
      }
    });

    it("正常系: セッションが存在しない場合、null を返す", async () => {
      const mock = createMockAuthService({ session: null });

      const result = await runWithMock(
        Effect.gen(function* () {
          const service = yield* AuthService;
          return yield* service.getSession();
        }),
        mock
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toBeNull();
      }
    });
  });

  describe("signOut", () => {
    it("正常系: サインアウトに成功する", async () => {
      const mock = createMockAuthService();

      const result = await runWithMock(
        Effect.gen(function* () {
          const service = yield* AuthService;
          return yield* service.signOut();
        }),
        mock
      );

      expect(Either.isRight(result)).toBe(true);
    });

    it("異常系: サインアウトに失敗した場合、SignOutError を返す", async () => {
      const mock = createMockAuthService({ signOutError: true });

      const result = await runWithMock(
        Effect.gen(function* () {
          const service = yield* AuthService;
          return yield* service.signOut();
        }),
        mock
      );

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(SignOutError);
        expect(result.left._tag).toBe("SignOutError");
      }
    });
  });

  describe("sendMagicLink", () => {
    it("正常系: Magic Link 送信に成功する", async () => {
      const mock = createMockAuthService();

      const result = await runWithMock(
        Effect.gen(function* () {
          const service = yield* AuthService;
          return yield* service.sendMagicLink("test@example.com", "/dashboard");
        }),
        mock
      );

      expect(Either.isRight(result)).toBe(true);
    });

    it("異常系: Magic Link 送信に失敗した場合、MagicLinkError を返す", async () => {
      const mock = createMockAuthService({ magicLinkError: true });

      const result = await runWithMock(
        Effect.gen(function* () {
          const service = yield* AuthService;
          return yield* service.sendMagicLink("test@example.com", "/dashboard");
        }),
        mock
      );

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(MagicLinkError);
        expect(result.left._tag).toBe("MagicLinkError");
      }
    });
  });

  describe("findAccountByUserId", () => {
    it("正常系: アカウントが存在する場合、アカウントを返す", async () => {
      const mockAccount = { providerId: "github" } as MockAccount;
      const mock = createMockAuthService({ account: mockAccount });

      const result = await runWithMock(
        Effect.gen(function* () {
          const service = yield* AuthService;
          return yield* service.findAccountByUserId("user-1");
        }),
        mock
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right?.providerId).toBe("github");
      }
    });

    it("正常系: アカウントが存在しない場合、undefined を返す", async () => {
      const mock = createMockAuthService({ account: undefined });

      const result = await runWithMock(
        Effect.gen(function* () {
          const service = yield* AuthService;
          return yield* service.findAccountByUserId("user-1");
        }),
        mock
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toBeUndefined();
      }
    });

    it("異常系: アカウント検索に失敗した場合、AuthRepositoryError を返す", async () => {
      const mock = createMockAuthService({ accountQueryError: true });

      const result = await runWithMock(
        Effect.gen(function* () {
          const service = yield* AuthService;
          return yield* service.findAccountByUserId("user-1");
        }),
        mock
      );

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(AuthRepositoryError);
        expect(result.left._tag).toBe("AuthRepositoryError");
      }
    });
  });
});
