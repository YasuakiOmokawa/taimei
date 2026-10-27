import { expect, it } from "vitest";
import { MembershipAnswer } from "@/src/lib/membership-answer";
import { membershipAnswerOf } from "../auth";

it("SDK の company_active が true の答えは、所属する人を持つ Active に写す", () => {
  expect(
    membershipAnswerOf({ companyActive: true, memberUserIds: ["u_1"] }),
  ).toEqual(MembershipAnswer.Active({ memberUserIds: ["u_1"] }));
});

it("SDK の company_active が false の答えは Deleted に写す (SDK 5.1 は削除済みの事業所と存在しない事業所を分けないので、存在しない事業所も Deleted になる)", () => {
  expect(
    membershipAnswerOf({ companyActive: false, memberUserIds: [] }),
  ).toEqual(MembershipAnswer.Deleted());
});
