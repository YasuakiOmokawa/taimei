// biome-ignore-all lint/suspicious/noExplicitAny: Mock 用に proto 全フィールドを満たさない部分実装を許容するため (AuthClient.layerTest の Partial 型キャストと整合)。
import { it } from "@effect/vitest";
import { Effect, Layer, Result } from "effect";
import { describe, expect } from "vitest";
import { AuthClient } from "../auth-client-service";
import { AuthService } from "../auth-service";
import { CookieReader } from "../cookie-reader-service";

// ADR-005 Phase 2.5: AuthClient.layerTest + CookieReader.layerTest の組合せで getSession の
// 内部 RPC 結果分岐 (token 有無 + verifySession の user/session 有無 + RPC throw) を網羅する。
// 既存の auth-service.test.ts は AuthService instance 全体を mock する consumer 視点だが、
// 本ファイルは AuthService 内部の Effect.gen フロー (CookieReadError → SessionError wrap、
// 早期 return、tryPromise の catch) を実 instance で検証する。
// ADR-008: signOut は taimei-auth /account の SignOutButton に集約済のためテスト削除。

const provideMocks = (
  cookieToken: string | undefined,
  authClientMock: Parameters<typeof AuthClient.layerTest>[0],
) =>
  Layer.mergeAll(
    CookieReader.layerTest(cookieToken),
    AuthClient.layerTest(authClientMock),
  );

const runAuth = <A, E>(
  effect: Effect.Effect<A, E, AuthService>,
  layer: Layer.Layer<AuthClient | CookieReader, never>,
) =>
  effect.pipe(
    Effect.provide(AuthService.layer.pipe(Layer.provide(layer))),
    Effect.result,
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

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) expect(result.success).toBeNull();
    expect(verifyCalled).toBe(false);
  });

  it("token あり + verifySession が user/session を返すとセッションが返る", async () => {
    // VerifySessionResponse は oneof outcome へ変更
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

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result) && result.success) {
      expect(result.success.user.id).toBe("user-1");
      expect(result.success.user.email).toBe("alice@example.com");
      expect(result.success.session.id).toBe("sess-1");
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

    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isSuccess(result)) expect(result.success).toBeNull();
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

    expect(Result.isFailure(result)).toBe(true);
    if (Result.isFailure(result))
      expect(result.failure._tag).toBe("SessionError");
  });
});
