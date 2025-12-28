import { describe, it, expect } from "vitest";
import { shouldShowExistingAccountFlash } from "../useLoginPageFlash";

describe("shouldShowExistingAccountFlash", () => {
  it("from=signup の場合 true を返す", () => {
    expect(shouldShowExistingAccountFlash("signup")).toBe(true);
  });

  it("from が null の場合 false を返す", () => {
    expect(shouldShowExistingAccountFlash(null)).toBe(false);
  });

  it("from が signup 以外の値の場合 false を返す", () => {
    expect(shouldShowExistingAccountFlash("other")).toBe(false);
    expect(shouldShowExistingAccountFlash("login")).toBe(false);
    expect(shouldShowExistingAccountFlash("")).toBe(false);
  });
});
