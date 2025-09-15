import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { Data, Effect, Layer } from "effect";
import { tags2 } from "@/db/drizzle/schema";
import { eq } from "drizzle-orm";

const makeTag2Repository = Effect.andThen(PgDrizzle.PgDrizzle, (pgdrizzle) => {
  return {
    findById: (id: string) => {
      return Effect.tryPromise({
        try: () => pgdrizzle.select().from(tags2).where(eq(tags2.id, id)),
        catch: (e) => new Tag2RepositoryError({ message: String(e) }),
      });
    },
    findAll: () => {
      return Effect.tryPromise({
        try: () => pgdrizzle.select().from(tags2),
        catch: (e) => new Tag2RepositoryError({ message: String(e) }),
      });
    },
  };
});

export class Tag2Repository extends Effect.Tag("Tag2Repository")<
  Tag2Repository,
  Effect.Effect.Success<typeof makeTag2Repository>
>() {
  static Live = Layer.effect(this, makeTag2Repository);
}

export class Tag2RepositoryError extends Data.TaggedError(
  "Tag2RepositoryError"
)<{
  message: string;
}> {}
