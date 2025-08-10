import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { PgDrizzleLive } from "@/app/layers/lives/pg_drizzle_live";
import { Effect } from "effect";
import { tags2 } from "@/db/drizzle/schema";

const program = Effect.gen(function* () {
  const db = yield* PgDrizzle.PgDrizzle;
  const results = yield* db.select().from(tags2);
  console.log(results);
});
const runnable = Effect.provide(program, PgDrizzleLive);
Effect.runPromise(runnable);
