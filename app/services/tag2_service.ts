import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { Data, Effect, Schema } from "effect";
import { tags2 } from "@/db/drizzle/schema";
import { eq } from "drizzle-orm";
import { Tag2Id } from "@/app/schema/tag2";

export class Tag2NotFound extends Data.TaggedError("Tag2NotFound")<{
  message: string;
}> {}

export class Tag2ParseError extends Data.TaggedError("Tag2ParseError")<{
  message: string;
}> {}

export class Tag2ServiceError extends Data.TaggedError("Tag2ServiceError")<{
  message: string;
}> {}

export class Tag2Service extends Effect.Service<Tag2Service>()(
  "services/Tag2Service",
  {
    effect: Effect.gen(function* () {
      const pgdrizzle = yield* PgDrizzle.PgDrizzle;

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
        Effect.tryPromise({
          try: () => pgdrizzle.select().from(tags2),
          catch: (e) =>
            new Tag2ServiceError({ message: `findAll failed: ${e}` }),
        });

      const find = (id: string) =>
        Effect.gen(function* () {
          yield* validateTag2Id(id);
          const tag = yield* Effect.tryPromise({
            try: () =>
              pgdrizzle
                .select()
                .from(tags2)
                .where(eq(tags2.id, id))
                .then((res) => res.at(0)),
            catch: (e) =>
              new Tag2ServiceError({ message: `find failed: ${e}` }),
          });
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
