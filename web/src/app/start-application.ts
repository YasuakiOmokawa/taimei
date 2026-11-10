import type { Layer } from "effect";
import { Runtime } from "foldkit";
import { crashView } from "../shared/crash-view";

type FixedByStart = "crash" | "devTools" | "freezeModel" | "slow" | "resources";

type StartableConfig<Model, Message extends { _tag: string }, Resources> = Omit<
  Runtime.RoutingApplicationConfig<Model, Message, Resources>,
  FixedByStart
> &
  Readonly<{ resources: Layer.Layer<NoInfer<Resources>> }>;

export const startApplication = <
  Model,
  Message extends { _tag: string },
  Resources,
>(
  config: StartableConfig<Model, Message, Resources>,
) =>
  Runtime.run(
    Runtime.makeApplication({
      ...config,
      crash: { view: crashView },
      devTools: false,
    }),
  );
