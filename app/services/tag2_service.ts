import { Data, Effect, Layer } from "effect";
import { Tag2Repository } from "./tag2_repository";
import { Schema } from "effect";

const Tag2Id = Schema.Struct({
  id: Schema.UUID,
});

class Tag2NotFound extends Data.TaggedError("Tag2NotFound")<{
  message: string;
}> {}

const makeTag2Service = Effect.gen(function* () {
  const tag2Repository = yield* Tag2Repository;
  return {
    findAll: () =>
      Effect.gen(function* () {
        const tags = yield* tag2Repository.findAll();
        return tags;
      }),
    find: (id: string) =>
      Effect.gen(function* () {
        const tag = yield* tag2Repository.find(id);
        if (!tag) {
          return yield* new Tag2NotFound({
            message: `Tag2NotFound: ${id}`,
          });
        }
        return tag;
      }),
  };
});

export class Tag2Service extends Effect.Tag("Tag2Service")<
  Tag2Service,
  Effect.Effect.Success<typeof makeTag2Service>
>() {
  static Live = Layer.effect(this, makeTag2Service);
}
