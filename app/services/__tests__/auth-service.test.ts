import { Effect, Either } from "effect";
import { describe, expect, it } from "vitest";
import { Email } from "@/app/domain/email";
import { MagicLinkError } from "../auth-errors";
import { AuthService } from "../auth-service";

// ConnectRPC 移行後のセッション型（auth-service RPC レスポンスに対応）
type MockSession = {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  session: {
    id: string;
    token: string;
    expiresAt: Date;
    userId: string;
  };
} | null;

const createMockAuthService = (
  options: {
    session?: MockSession;
    magicLinkError?: boolean;
  } = {},
) =>
  new AuthService({
    getSession: () => Effect.succeed(options.session ?? null),

    sendMagicLink: (_email: Email, _callbackUrl: string) =>
      options.magicLinkError
        ? Effect.fail(
            new MagicLinkError({ cause: new Error("Magic link failed") }),
          )
        : Effect.succeed(undefined as void),
  });

const runWithMock = <A, E>(
  effect: Effect.Effect<A, E, AuthService>,
  mock: AuthService,
) =>
  effect.pipe(
    Effect.provideService(AuthService, mock),
    Effect.either,
    Effect.runPromise,
  );

describe("AuthService", () => {
  describe("getSession", () => {
    it("正常系: セッションが存在する場合、セッションを返す", async () => {
      const mockSession = {
        session: {
          id: "session-1",
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
      } satisfies NonNullable<MockSession>;

      const mock = createMockAuthService({ session: mockSession });

      const result = await runWithMock(
        Effect.gen(function* () {
          const service = yield* AuthService;
          return yield* service.getSession();
        }),
        mock,
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
        mock,
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toBeNull();
      }
    });
  });

  describe("sendMagicLink", () => {
    it("正常系: Magic Link 送信に成功する", async () => {
      const mock = createMockAuthService();

      const result = await runWithMock(
        Effect.gen(function* () {
          const service = yield* AuthService;
          return yield* service.sendMagicLink(
            Email.makeSync("test@example.com"),
            "/dashboard",
          );
        }),
        mock,
      );

      expect(Either.isRight(result)).toBe(true);
    });

    it("異常系: Magic Link 送信に失敗した場合、MagicLinkError を返す", async () => {
      const mock = createMockAuthService({ magicLinkError: true });

      const result = await runWithMock(
        Effect.gen(function* () {
          const service = yield* AuthService;
          return yield* service.sendMagicLink(
            Email.makeSync("test@example.com"),
            "/dashboard",
          );
        }),
        mock,
      );

      expect(Either.isLeft(result)).toBe(true);
      if (Either.isLeft(result)) {
        expect(result.left).toBeInstanceOf(MagicLinkError);
        expect(result.left._tag).toBe("MagicLinkError");
      }
    });
  });
});
