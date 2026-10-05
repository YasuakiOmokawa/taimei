import { describe, expect, it } from "vitest";
import { memberLabel } from "../member-label";

describe("memberLabel", () => {
  it("名前があれば名前を返す", () => {
    expect(memberLabel({ name: "山田 太郎", email: "taro@example.com" })).toBe(
      "山田 太郎",
    );
  });

  it("名前が空ならメールアドレスを返す", () => {
    expect(memberLabel({ name: "", email: "taro@example.com" })).toBe(
      "taro@example.com",
    );
  });
});
