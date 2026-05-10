// Server Component / Server Action 文脈で session cookie token を取り出す責務の Effect.Service。
// 動的 import("next/headers") を Adapter 内部に閉じ込め、AuthService から Next.js 依存を切り離す。
// 経緯は ADR-005 Phase 2 参照 (plans/taimei/ADR-005-auth-service-pattern-unification.md)。
import "server-only";
import { extractSessionTokenFromCookieHeader } from "@taimei-code/auth-client";
import { Effect, Layer } from "effect";
import { CookieReadError } from "./cookie-reader-errors";

export class CookieReader extends Effect.Service<CookieReader>()(
  "services/CookieReader",
  {
    effect: Effect.gen(function* () {
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
  // テスト用 Layer。null / non-null 分岐の両方を切り替える必要があるため Custom 形式
  // (固定値 1 種では `getSession` の「token あり/なし」分岐網羅不可、ADR-005 DA9 参照)。
  //
  // 実装ノート: Effect.Service は内部で `_tag` を保持するため、`Layer.succeed` には plain object
  // ではなく `new this({...})` で instance 化したものを渡す必要がある。
  static Custom = (sessionToken: string | undefined) =>
    Layer.succeed(
      this,
      new this({ readSessionToken: Effect.succeed(sessionToken) }),
    );
}
