import { describe, it, expect } from "vitest";
import {
  shouldShowExistingAccountFlash,
  shouldShowAccountNotLinkedFlash,
} from "../useLoginPageFlash";

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

describe("shouldShowAccountNotLinkedFlash", () => {
  it("errors に account_not_linked が含まれる場合 true を返す", () => {
    expect(shouldShowAccountNotLinkedFlash(["account_not_linked"])).toBe(true);
    expect(
      shouldShowAccountNotLinkedFlash(["signin_failed", "account_not_linked"])
    ).toBe(true);
  });

  it("errors が空配列の場合 false を返す", () => {
    expect(shouldShowAccountNotLinkedFlash([])).toBe(false);
  });

  it("errors に account_not_linked が含まれない場合 false を返す", () => {
    expect(shouldShowAccountNotLinkedFlash(["signin_failed"])).toBe(false);
    expect(shouldShowAccountNotLinkedFlash(["other"])).toBe(false);
  });
});
