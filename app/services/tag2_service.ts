import { Effect, Layer } from "effect";
import { Tag2Repository } from "./tag2_repository";

const makeTag2Service = Effect.gen(function* () {
  const tag2Repository = yield* Tag2Repository;
  return {
    findAll: () =>
      Effect.gen(function* () {
        const tags = yield* tag2Repository.findAll();
        return tags;
      }),
  };
});

export class Tag2Service extends Effect.Tag("Tag2Service")<
  Tag2Service,
  Effect.Effect.Success<typeof makeTag2Service>
>() {
  static Live = Layer.effect(this, makeTag2Service);
}
