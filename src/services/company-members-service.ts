import type { Member } from "@taimei-code/auth-client";
import { Context, type Effect, Layer, Schema } from "effect";

export class MemberListError extends Schema.TaggedError<MemberListError>()(
  "MemberListError",
  {
    cause: Schema.Defect(),
  },
) {}

export class CompanyMembers extends Context.Service<
  CompanyMembers,
  { readonly list: Effect.Effect<readonly Member[], MemberListError> }
>()("taimei/src/services/CompanyMembers") {
  static readonly layerTest = (
    list: Effect.Effect<readonly Member[], MemberListError>,
  ) => Layer.succeed(CompanyMembers, CompanyMembers.of({ list }));
}
