// Service にした経緯は ADR-005 Phase 2.5 (plans/taimei/ADR-005-auth-service-pattern-unification.md)。
import "server-only";
import { Context, Effect, Layer } from "effect";
import { authClient } from "@/lib/auth/client";

type AuthClientShape = typeof authClient;

export class AuthClient extends Context.Service<AuthClient>()(
  "services/AuthClient",
  {
    make: Effect.gen(function* () {
      // Phase 1 で作った module-singleton をそのまま service instance 化する。
      // singleton 自体は維持 (server-only ガードを `lib/auth/client.ts` 経由で連鎖させるため)。
      return {
        authService: authClient.authService,
        userService: authClient.userService,
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);

  // テスト用: authService / userService の任意メソッドを差し替える Layer。
  // Partial 型キャストで「テストが必要なメソッドだけ実装」を許容する (RPC 全 method 実装は冗長)。
  static readonly layerTest = (overrides: {
    authService?: Partial<AuthClientShape["authService"]>;
    userService?: Partial<AuthClientShape["userService"]>;
  }) =>
    Layer.succeed(
      this,
      this.of({
        authService: (overrides.authService ??
          {}) as AuthClientShape["authService"],
        userService: (overrides.userService ??
          {}) as AuthClientShape["userService"],
      }),
    );
}
