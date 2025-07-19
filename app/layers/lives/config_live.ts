import { ConfigService } from "@/app/services/config_service";
import { Effect, Layer } from "effect";

export const ConfigLive = Layer.succeed(
  ConfigService,
  ConfigService.of({
    getConfig: Effect.succeed({
      logLevel: "INFO",
      connection: "mysql:username:password@hostname:port/database_name",
    }),
  })
);
