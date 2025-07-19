import { Context, Effect } from "effect";

export class ConfigService extends Context.Tag("app/services/ConfigService")<
  ConfigService,
  {
    readonly getConfig: Effect.Effect<{
      readonly logLevel: string;
      readonly connection: string;
    }>;
  }
>() {}
