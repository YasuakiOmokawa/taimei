import { describe, expect, it } from "vitest";
import { getInitials } from "../initials";

describe("getInitials", () => {
  it("単一語: 先頭 1 文字を大文字で返す", () => {
    expect(getInitials("alice")).toBe("A");
  });

  it("複数語: 各語の先頭 1 文字を結合し最大 2 文字にする", () => {
    expect(getInitials("Alice Smith")).toBe("AS");
  });

  it("3 語以上: 先頭 2 文字に切り詰める", () => {
    expect(getInitials("Alice Bob Carol")).toBe("AB");
  });

  it("名前空欄時: fallback '??' を返す", () => {
    expect(getInitials("")).toBe("??");
  });

  it("name が undefined/null 相当でも fallback を返す", () => {
    expect(getInitials(undefined as unknown as string)).toBe("??");
  });

  it("全て小文字: 大文字化される", () => {
    expect(getInitials("john doe")).toBe("JD");
  });
});
