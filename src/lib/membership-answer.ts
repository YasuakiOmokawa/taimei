import { Data } from "effect";

export type MembershipAnswer = Data.TaggedEnum<{
  Active: { readonly memberUserIds: readonly string[] };
  Deleted: {};
  Unknown: { readonly cause: unknown };
}>;
export const MembershipAnswer = Data.taggedEnum<MembershipAnswer>();

export type CheckMemberships = (request: {
  companyId: string;
  userIds: string[];
}) => Promise<MembershipAnswer>;
