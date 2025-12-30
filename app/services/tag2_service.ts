import { Data, Effect, Schema } from "effect";
import { Tag2Repository } from "./tag2_repository";
import { Tag2Id } from "@/app/schema/tag2";

class Tag2NotFound extends Data.TaggedError("Tag2NotFound")<{
  message: string;
}> {}

class Tag2ParseError extends Data.TaggedError("Tag2ParseError")<{
  message: string;
}> {}

export class Tag2Service extends Effect.Service<Tag2Service>()(
  "services/Tag2Service",
  {
    effect: Effect.gen(function* () {
      const tag2Repository = yield* Tag2Repository;

      const validateTag2Id = (id: string) =>
        Effect.gen(function* () {
          yield* Schema.decode(Tag2Id)(id).pipe(
            Effect.catchTag(
              "ParseError",
              (error) =>
                new Tag2ParseError({
                  message: `Tag2ParseError: ${error.message}`,
                })
            )
          );
        });

      const findAll = () =>
        Effect.gen(function* () {
          const tags = yield* tag2Repository.findAll();
          return tags;
        });

      const find = (id: string) =>
        Effect.gen(function* () {
          yield* validateTag2Id(id);
          const tag = yield* tag2Repository.find(id);
          if (!tag) {
            return yield* new Tag2NotFound({
              message: `Tag2NotFound: ${id}`,
            });
          }
          return tag;
        });

      return {
        findAll,
        find,
      } as const;
    }),
  }
) {}
