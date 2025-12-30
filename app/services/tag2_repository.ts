import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { Data, Effect } from "effect";
import { tags2 } from "@/db/drizzle/schema";
import { eq } from "drizzle-orm";

export class Tag2Repository extends Effect.Service<Tag2Repository>()(
  "services/Tag2Repository",
  {
    effect: Effect.gen(function* () {
      const pgdrizzle = yield* PgDrizzle.PgDrizzle;

      return {
        find: (id: string) =>
          Effect.tryPromise({
            try: () =>
              pgdrizzle
                .select()
                .from(tags2)
                .where(eq(tags2.id, id))
                .then((res) => res.at(0)),
            catch: (e) =>
              new Tag2RepositoryError({ message: `Tag2RepositoryError: ${e}` }),
          }),

        findAll: () =>
          Effect.tryPromise({
            try: () => pgdrizzle.select().from(tags2),
            catch: (e) =>
              new Tag2RepositoryError({ message: `Tag2RepositoryError: ${e}` }),
          }),
      } as const;
    }),
  }
) {}

export class Tag2RepositoryError extends Data.TaggedError(
  "Tag2RepositoryError"
)<{
  message: string;
}> {}
