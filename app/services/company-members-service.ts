import type { Member } from "@taimei-code/auth-client";
import { Context, Data, Effect, Layer } from "effect";
import { listMembers } from "@/app/lib/auth-guard";

export class MemberListError extends Data.TaggedError("MemberListError")<{
  cause: unknown;
}> {}

export class CompanyMembers extends Context.Service<
  CompanyMembers,
  { readonly list: Effect.Effect<readonly Member[], MemberListError> }
>()("services/CompanyMembers") {
  // 事業所は session から SDK が決める。CompanyContext と同じ session を読む
  static readonly layer = Layer.succeed(this, {
    list: Effect.tryPromise({
      try: () => listMembers(),
      catch: (cause) => new MemberListError({ cause }),
    }).pipe(
      Effect.flatMap((result) =>
        result.ok
          ? Effect.succeed(result.data.members)
          : Effect.fail(new MemberListError({ cause: result.reason })),
      ),
    ),
  });

  static readonly layerTest = (
    list: Effect.Effect<readonly Member[], MemberListError>,
  ) => Layer.succeed(this, { list });
}
