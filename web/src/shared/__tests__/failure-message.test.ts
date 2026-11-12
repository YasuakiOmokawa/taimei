import { Cause, Schema } from "effect";
import { expect, it } from "vitest";
import { failureMessageOf } from "../failure-message";

it("契約の失敗の外の失敗は、文言を引く引数の型に入らない (bun run typecheck で見る)", () => {
  class Unlisted extends Schema.TaggedError<
    Unlisted,
    { readonly brand: unique symbol }
  >()("Unlisted", {}) {}

  // @ts-expect-error 契約に宣言していない失敗は、文言の表に無い
  const message = failureMessageOf(Cause.fail(new Unlisted()), "既定");

  expect(message).toBe("既定");
});
