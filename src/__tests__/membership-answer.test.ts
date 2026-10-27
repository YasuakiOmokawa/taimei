import { CompanyActivationStatus } from "@taimei-code/auth-client";
import { expect, it } from "vitest";
import { MembershipAnswer } from "@/src/lib/membership-answer";
import { membershipAnswerOf } from "../auth";

it("ACTIVE の答えは、所属する人を持つ Active に写す", () => {
  expect(
    membershipAnswerOf({
      companyActivationStatus: CompanyActivationStatus.ACTIVE,
      memberUserIds: ["u_1"],
    }),
  ).toEqual(MembershipAnswer.Active({ memberUserIds: ["u_1"] }));
});

it("DELETED の答えは Deleted に写す", () => {
  expect(
    membershipAnswerOf({
      companyActivationStatus: CompanyActivationStatus.DELETED,
      memberUserIds: [],
    }),
  ).toEqual(MembershipAnswer.Deleted());
});

it.each([
  [
    "NOT_FOUND の答えは、向き先の違う auth ホストや戻した DB でも返るので",
    CompanyActivationStatus.NOT_FOUND,
    "NOT_FOUND",
  ],
  [
    "UNSPECIFIED の答えは、5.2.0 より前の auth ホストの答えなので",
    CompanyActivationStatus.UNSPECIFIED,
    "UNSPECIFIED",
  ],
  ["SDK の知らない状態の数値は", 99 as CompanyActivationStatus, "99"],
])(
  "%s、消さずに状態を cause に残した Unknown に写す",
  (_, status, statusInMessage) => {
    expect(
      membershipAnswerOf({
        companyActivationStatus: status,
        memberUserIds: [],
      }),
    ).toEqual(
      MembershipAnswer.Unknown({
        cause: new Error(`companyActivationStatus: ${statusInMessage}`),
      }),
    );
  },
);
