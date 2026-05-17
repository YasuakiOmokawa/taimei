// biome-ignore-all lint/suspicious/noExplicitAny: Mock 用に proto 全フィールドを満たさない部分実装を許容するため (AuthClient.Custom の Partial 型キャストと整合)。CLAUDE.md「Pitfalls / Lint」のブロック形式 disable 推奨に従う。
import { it } from "@effect/vitest";
import { Effect, Either, Layer } from "effect";
import { describe, expect } from "vitest";
import { AuthClient } from "../auth-client-service";
import { AuthService } from "../auth-service";
import { CookieReader } from "../cookie-reader-service";

// ADR-005 Phase 2.5: AuthClient.Custom + CookieReader.Custom の組合せで getSession / signOut の
// 内部 RPC 結果分岐 (token 有無 + verifySession の user/session 有無 + RPC throw) を網羅する。
// 既存の auth-service.test.ts は AuthService instance 全体を mock する consumer 視点だが、
// 本ファイルは AuthService 内部の Effect.gen フロー (CookieReadError → SessionError wrap、
// 早期 return、tryPromise の catch) を実 instance で検証する。

const provideMocks = (
  cookieToken: string | undefined,
  authClientMock: Parameters<typeof AuthClient.Custom>[0],
) =>
  Layer.mergeAll(
    CookieReader.Custom(cookieToken),
    AuthClient.Custom(authClientMock),
  );

const runAuth = <A, E>(
  effect: Effect.Effect<A, E, AuthService>,
  layer: Layer.Layer<AuthClient | CookieReader, never>,
) =>
  effect.pipe(
    Effect.provide(AuthService.Default.pipe(Layer.provide(layer))),
    Effect.either,
    Effect.runPromise,
  );

describe("AuthService.getSession (Phase 2.5 統合テスト)", () => {
  it("token が無いと verifySession を呼ばずに null", async () => {
    let verifyCalled = false;
    const layer = provideMocks(undefined, {
      authService: {
        verifySession: (async () => {
          verifyCalled = true;
          return { outcome: { case: "error", value: { reason: 2 } } };
        }) as any,
      },
    });

    const result = await runAuth(
      Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.getSession();
      }),
      layer,
    );

    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) expect(result.right).toBeNull();
    expect(verifyCalled).toBe(false);
  });

  it("token あり + verifySession が user/session を返すとセッションが返る", async () => {
    // ADR-001 R2: VerifySessionResponse は oneof outcome へ変更
    const layer = provideMocks("test-token", {
      authService: {
        verifySession: (async () => ({
          outcome: {
            case: "ok",
            value: {
              user: {
                id: "user-1",
                name: "Alice",
                email: "alice@example.com",
                emailVerified: true,
                image: undefined,
                createdAt: "2026-01-01T00:00:00Z",
                updatedAt: "2026-01-02T00:00:00Z",
                revision: 0,
              },
              session: {
                id: "sess-1",
                expiresAt: "2026-12-31T00:00:00Z",
                sessionKind: "user",
              },
            },
          },
        })) as any,
      },
    });

    const result = await runAuth(
      Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.getSession();
      }),
      layer,
    );

    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result) && result.right) {
      expect(result.right.user.id).toBe("user-1");
      expect(result.right.user.email).toBe("alice@example.com");
      expect(result.right.session.id).toBe("sess-1");
    }
  });

  it("token あり + verifySession が error outcome を返すと null (期限切れ / REVISION_OUTDATED 等)", async () => {
    const layer = provideMocks("stale-token", {
      authService: {
        verifySession: (async () => ({
          outcome: { case: "error", value: { reason: 7 } }, // RESULT_REVISION_OUTDATED
        })) as any,
      },
    });

    const result = await runAuth(
      Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.getSession();
      }),
      layer,
    );

    expect(Either.isRight(result)).toBe(true);
    if (Either.isRight(result)) expect(result.right).toBeNull();
  });

  it("verifySession が throw すると SessionError に wrap される", async () => {
    const layer = provideMocks("test-token", {
      authService: {
        verifySession: (async () => {
          throw new Error("network error");
        }) as any,
      },
    });

    const result = await runAuth(
      Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.getSession();
      }),
      layer,
    );

    expect(Either.isLeft(result)).toBe(true);
    if (Either.isLeft(result)) expect(result.left._tag).toBe("SessionError");
  });
});

describe("AuthService.signOut (Phase 2.5 統合テスト)", () => {
  it("token が無いと RPC を呼ばずに完了 (no-op)", async () => {
    let signOutCalled = false;
    const layer = provideMocks(undefined, {
      authService: {
        signOut: (async () => {
          signOutCalled = true;
          return {};
        }) as any,
      },
    });

    const result = await runAuth(
      Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.signOut();
      }),
      layer,
    );

    expect(Either.isRight(result)).toBe(true);
    expect(signOutCalled).toBe(false);
  });

  it("token あり + signOut が成功すると RPC が呼ばれる", async () => {
    let calledToken: string | undefined;
    const layer = provideMocks("test-token", {
      authService: {
        signOut: (async ({ sessionToken }: { sessionToken: string }) => {
          calledToken = sessionToken;
          return {};
        }) as any,
      },
    });

    const result = await runAuth(
      Effect.gen(function* () {
        const service = yield* AuthService;
        return yield* service.signOut();
      }),
      layer,
    );

    expect(Either.isRight(result)).toBe(true);
    expect(calledToken).toBe("test-token");
  });
});
