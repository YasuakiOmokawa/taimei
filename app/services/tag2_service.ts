import { Data, Effect, Layer, Schema } from "effect";
import { Tag2Repository } from "./tag2_repository";
import { Tag2Id } from "@/app/schema/tag2";

class Tag2NotFound extends Data.TaggedError("Tag2NotFound")<{
  message: string;
}> {}

class Tag2ParseError extends Data.TaggedError("Tag2ParseError")<{
  message: string;
}> {}

const makeTag2Service = Effect.gen(function* () {
  const tag2Repository = yield* Tag2Repository;

  const findAll = () =>
    Effect.gen(function* () {
      const tags = yield* tag2Repository.findAll();
      return tags;
    });

  const find = (id: string) =>
    Effect.gen(function* () {
      const parsedId = yield* Schema.decode(Tag2Id)(id).pipe(
        Effect.catchTag(
          "ParseError",
          (error) =>
            new Tag2ParseError({
              message: `Tag2ParseError: ${error.message}`,
            })
        )
      );
      const tag = yield* tag2Repository.find(parsedId);
      if (!tag) {
        return yield* new Tag2NotFound({
          message: `Tag2NotFound: ${parsedId}`,
        });
      }
      return tag;
    });

  return {
    findAll,
    find,
  };
});

export class Tag2Service extends Effect.Tag("Tag2Service")<
  Tag2Service,
  Effect.Effect.Success<typeof makeTag2Service>
>() {
  static Live = Layer.effect(this, makeTag2Service);
}
