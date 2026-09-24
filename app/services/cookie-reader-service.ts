// Server Component / Server Action 文脈で session cookie token を取り出す責務の Service。
// 動的 import("next/headers") を Adapter 内部に閉じ込め、AuthService から Next.js 依存を切り離す。
// 経緯は ADR-005 Phase 2 参照 (plans/taimei/ADR-005-auth-service-pattern-unification.md)。
import "server-only";
import { extractSessionTokenFromCookieHeader } from "@taimei-code/auth-client";
import { Context, Effect, Layer } from "effect";
import { CookieReadError } from "./cookie-reader-errors";

export class CookieReader extends Context.Service<CookieReader>()(
  "services/CookieReader",
  {
    make: Effect.gen(function* () {
      return {
        // 動的 import を使う理由: next/headers を静的 import すると、(a) Server Component / Server
        // Action 文脈外で評価されると build error、(b) vitest 単体実行で next/headers が解決失敗、
        // の 2 つの問題がある。try callback まで評価を遅延することで両方回避。
        // ES module キャッシュが効くので 2 回目以降のオーバーヘッドはない。
        readSessionToken: Effect.tryPromise({
          try: async () => {
            const nextHeadersModule = await import("next/headers");
            const headersList = await nextHeadersModule.headers();
            return extractSessionTokenFromCookieHeader(
              headersList.get("cookie") || "",
            );
          },
          catch: (e) => new CookieReadError({ cause: e }),
        }),
      } as const;
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);

  // getSession の token あり/なし分岐を網羅するため引数化 (ADR-005 DA9)。
  static readonly layerTest = (sessionToken: string | undefined) =>
    Layer.succeed(
      this,
      this.of({ readSessionToken: Effect.succeed(sessionToken) }),
    );
}
