import { Layer } from "effect";
import { ConfigLive } from "./config_live";
import { MyDatabaseLive } from "./my_database_live";
import { AppConfigLive } from "./app_config_live";

export const MyMainLive = MyDatabaseLive.pipe(
  Layer.provide(AppConfigLive),
  Layer.provide(ConfigLive)
);

export const MyMainLiveDebuggable = MyDatabaseLive.pipe(
  Layer.provide(AppConfigLive),
  Layer.provideMerge(ConfigLive)
);
