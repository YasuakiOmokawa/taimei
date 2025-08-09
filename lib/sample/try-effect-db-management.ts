import { PgClient } from "@effect/sql-pg";
import { Config } from "effect";

const _PgLive = PgClient.layerConfig({
  password: Config.redacted("PGPASSWORD"),
  username: Config.string("PGUSER"),
});
