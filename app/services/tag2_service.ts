import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { Effect, Layer } from "effect";
import { tags2 } from "@/db/drizzle/schema";

const makeTag2Service = Effect.gen(function* () {
  const db = yield* PgDrizzle.PgDrizzle;
  return {
    findAll: () =>
      Effect.gen(function* () {
        const tags = yield* db.select().from(tags2);
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
