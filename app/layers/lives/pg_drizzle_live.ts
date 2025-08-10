import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { PgClient } from "@effect/sql-pg";
import { Cause, Config, Console, Layer } from "effect";

const PgLive = PgClient.layerConfig({
  password: Config.redacted("PGPASSWORD"),
  username: Config.string("PGUSER"),
  database: Config.string("PGDATABASE"),
  host: Config.string("PGHOST"),
  port: Config.succeed(5432),
}).pipe(Layer.tapErrorCause((cause) => Console.log(Cause.pretty(cause))));

const DrizzleLive = PgDrizzle.layer.pipe(Layer.provide(PgLive));

export const PgDrizzleLive = Layer.mergeAll(PgLive, DrizzleLive);
