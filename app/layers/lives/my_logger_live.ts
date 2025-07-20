import { ConfigService } from "@/app/services/config_service";
import { MyLoggerService } from "@/app/services/my_logger_service";
import { Effect, Layer } from "effect";

export const MyLoggerLive = Layer.effect(
  MyLoggerService,
  Effect.gen(function* () {
    // 依存サービス。構築対象エフェクトの外側に定義することで依存関係を表す。
    const config = yield* ConfigService;

    return {
      log: (message) =>
        Effect.gen(function* () {
          const { logLevel } = yield* config.getConfig;
          console.log(`[${logLevel}] ${message}`);
        }),
    };
  })
);
