import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { describe } from "vitest";
import { CookieReader } from "../cookie-reader-service";

// ADR-005 Phase 2: CookieReader.Custom バリアントの単体テスト。
// Live バリアントは Next.js の next/headers に依存するため、ここではテストせず
// Phase 2.5 で AuthClient.Mock と組み合わせた auth-service.ts 統合テストでカバーする。

describe("CookieReader", () => {
  describe("Custom", () => {
    it.effect("指定された session token をそのまま返す", () =>
      Effect.gen(function* () {
        const reader = yield* CookieReader;
        const result = yield* reader.readSessionToken;
        expect(result).toBe("test-token");
      }).pipe(Effect.provide(CookieReader.Custom("test-token"))),
    );

    it.effect("undefined を渡すと undefined を返す (未認証分岐の網羅用)", () =>
      Effect.gen(function* () {
        const reader = yield* CookieReader;
        const result = yield* reader.readSessionToken;
        expect(result).toBeUndefined();
      }).pipe(Effect.provide(CookieReader.Custom(undefined))),
    );
  });
});
