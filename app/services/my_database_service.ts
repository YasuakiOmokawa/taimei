import { Effect, Context } from "effect";
import { ConfigService } from "./config_service";
import { MyLoggerService } from "./my_logger_service";

export class MyDatabaseService extends Context.Tag(
  "app/services/MyDatabaseService"
)<
  MyDatabaseService,
  {
    readonly query: (
      sql: string
    ) => Effect.Effect<unknown, never, ConfigService | MyLoggerService>;
  }
>() {}
