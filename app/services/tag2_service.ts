import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { Effect } from "effect";
import { tags2 } from "@/db/drizzle/schema";

export class Tag2Service extends Effect.Service<Tag2Service>()(
  "app/services/Tag2Service",
  {
    effect: Effect.gen(function* () {
      const db = yield* PgDrizzle.PgDrizzle;
      return {
        getAll: () =>
          Effect.gen(function* () {
            const tags = yield* db.select().from(tags2);
            return tags;
          }),
      };
    }),
  }
) {}
