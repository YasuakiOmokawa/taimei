import type { Member } from "@taimei-code/auth-client";
import { Context, Effect, Layer, Schema } from "effect";
import { listMembers } from "@/app/lib/auth-guard";

export class MemberListError extends Schema.TaggedError<MemberListError>()(
  "MemberListError",
  {
    cause: Schema.Defect(),
  },
) {}

export class CompanyMembers extends Context.Service<
  CompanyMembers,
  { readonly list: Effect.Effect<readonly Member[], MemberListError> }
>()("taimei/app/services/CompanyMembers") {
  // 事業所は session から SDK が決める。CompanyContext と同じ session を読む
  static readonly layer = Layer.succeed(
    CompanyMembers,
    CompanyMembers.of({
      list: Effect.gen(function* () {
        const result = yield* Effect.tryPromise({
          try: () => listMembers(),
          catch: (cause) => new MemberListError({ cause }),
        });
        if (!result.ok)
          return yield* new MemberListError({ cause: result.reason });
        return result.data.members;
      }).pipe(Effect.withSpan("CompanyMembers.list")),
    }),
  );

  static readonly layerTest = (
    list: Effect.Effect<readonly Member[], MemberListError>,
  ) => Layer.succeed(CompanyMembers, CompanyMembers.of({ list }));
}
