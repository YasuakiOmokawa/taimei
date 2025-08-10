import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { PgClient } from "@effect/sql-pg";
import { Cause, Config, Console, Layer } from "effect";

const PgLive = PgClient.layerConfig({
  url: Config.redacted("DATABASE_URL"),
}).pipe(Layer.tapErrorCause((cause) => Console.log(Cause.pretty(cause))));

const DrizzleLive = PgDrizzle.layer.pipe(Layer.provide(PgLive));

export const PgDrizzleLive = Layer.mergeAll(PgLive, DrizzleLive);
