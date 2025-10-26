import { ConformAccountResistrationService } from "./conform-account-registration-service";
import { Tag2Service } from "./tag2_service";
import { PgDrizzleLive } from "../layers/lives/pg_drizzle_live";
import { Effect, Layer, ManagedRuntime } from "effect";
import { Tag2Repository } from "./tag2_repository";

// provide all services as layer
export const Live = Layer.mergeAll(
  Tag2Service.Live.pipe(
    Layer.provide(Tag2Repository.Live),
    Layer.provide(PgDrizzleLive)
  ),
  ConformAccountResistrationService.Live
);

// provide runtime for Next.js
export const makeNextRuntime = <R, E>(layer: Layer.Layer<R, E, never>) => {
  const runtime = ManagedRuntime.make(layer);
  const run = <A, E>(body: () => Effect.Effect<A, E, R>) =>
    runtime.runPromise(Effect.either(body()));
  return { run };
};

// provide service executable
export const { run: runService } = makeNextRuntime(Live);
