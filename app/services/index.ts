import { Tag2Service } from "./tag2_service";
import { PgDrizzleLive } from "../layers/lives/pg_drizzle_live";
import { Effect, Either, Layer, ManagedRuntime } from "effect";

// provide all services as layer
export const Live = Layer.mergeAll(
  Tag2Service.Default.pipe(Layer.provide(PgDrizzleLive))
);

// provide runtime for Next.js
export const makeNextRuntime = <R, E>(layer: Layer.Layer<R, E, never>) => {
  const runtime = ManagedRuntime.make(layer);
  const run = <A, E>(
    body: () => Effect.Effect<A, E, R>
  ): Promise<Either.Either<A, E>> =>
    runtime
      .runPromise(body())
      .then((a) => Either.right(a))
      .catch((e) => Either.left(e as E));
  return { run };
};

// provide service executable
export const { run: runService } = makeNextRuntime(Live);
