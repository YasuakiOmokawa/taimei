import { Schema } from "effect";
import { expect, it } from "vitest";
import { CompanyId } from "../ids";

const isCompanyId = Schema.is(CompanyId);

it("CompanyId は taimei-auth の company.id の形 (cmp_ + nanoid) だけを受け、ほかの id や 32 文字を超える値を受けない", () => {
  expect(isCompanyId("cmp_V1StGXR8_Z5jdHi6B-myT0aB")).toBe(true);
  expect(isCompanyId("")).toBe(false);
  expect(isCompanyId("u_1")).toBe(false);
  expect(isCompanyId("mbr_V1StGXR8_Z5jdHi6B-myT0aB")).toBe(false);
  expect(isCompanyId(`cmp_${"a".repeat(29)}`)).toBe(false);
});
