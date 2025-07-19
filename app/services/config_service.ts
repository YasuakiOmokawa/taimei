import { Context } from "effect";

export class ConfigService extends Context.Tag("app/services/ConfigService")<
  ConfigService,
  {}
>() {}
