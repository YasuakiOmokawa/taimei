// taimei-auth SDK の ConnectRPC client (authService / userService) を Service として注入する。
// Phase 1 で `lib/auth/client.ts` の module-singleton を作ったが、テストでは authClient 全体を
// vi.mock するか実 RPC を叩くしかなく、auth-service.ts や user-service.ts の RPC 結果分岐網羅が
// 不可能だった。Service 化で AuthClient.layerTest を提供し、Layer.provide で差し替え可能にする。
// 経緯は ADR-005 Phase 2.5 参照 (plans/taimei/ADR-005-auth-service-pattern-unification.md)。
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
