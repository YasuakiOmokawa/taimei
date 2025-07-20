import { ConfigService } from "@/app/services/config_service";
import { MyLoggerService } from "@/app/services/my_logger_service";
import { MyDatabaseService } from "@/app/services/my_database_service";
import { Effect, Layer } from "effect";

export const MyDatabaseLive = Layer.effect(
  MyDatabaseService,
  Effect.gen(function* () {
    const config = yield* ConfigService;
    const logger = yield* MyLoggerService;

    return {
      query: (sql: string) =>
        Effect.gen(function* () {
          yield* logger.log(`query is: ${sql}`);
          const { connection } = yield* config.getConfig;
          return { result: `results from ${connection}` };
        }),
    };
  })
);
