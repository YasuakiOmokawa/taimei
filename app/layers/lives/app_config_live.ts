import { Layer } from "effect";
import { ConfigLive } from "./config_live";
import { MyLoggerLive } from "./my_logger_live";

export const AppConfigLive = Layer.merge(ConfigLive, MyLoggerLive);
