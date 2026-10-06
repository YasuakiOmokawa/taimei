import { expect, it } from "vitest";
import { isCompanyAllowed } from "../company-gate";

it("許可した事業所だけを通す", () => {
  expect(isCompanyAllowed("cmp_a", "cmp_a,cmp_b")).toBe(true);
  expect(isCompanyAllowed("cmp_c", "cmp_a,cmp_b")).toBe(false);
});

it("一覧の各 id の前後の空白を除く", () => {
  expect(isCompanyAllowed("cmp_b", " cmp_a , cmp_b ")).toBe(true);
});

it("* は全事業所を通す", () => {
  expect(isCompanyAllowed("cmp_x", "*")).toBe(true);
});

it("未設定と空は誰も通さない", () => {
  expect(isCompanyAllowed("cmp_a", undefined)).toBe(false);
  expect(isCompanyAllowed("cmp_a", "")).toBe(false);
});
