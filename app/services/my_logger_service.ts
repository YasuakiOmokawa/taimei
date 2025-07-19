import { Effect, Context } from "effect";
import { ConfigService } from "./config_service";

export class MyLoggerService extends Context.Tag(
  "app/services/MyLoggerService"
)<
  MyLoggerService,
  {
    readonly log: (
      message: string
    ) => Effect.Effect<void, never, ConfigService>;
  }
>() {}
