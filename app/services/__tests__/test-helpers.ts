import { Effect, Layer, Either } from "effect";

/**
 * Effect を Layer と共に実行し、Either 型で結果を返す
 * テスト間の干渉を防ぎ、エラーハンドリングを型安全に行うための共通ヘルパー
 */
export const runWithLayer = <A, E, R, E2>(
  effect: Effect.Effect<A, E, R>,
  layer: Layer.Layer<R, E2, never>
): Promise<Either.Either<A, E | E2>> =>
  Effect.runPromise(Effect.either(effect.pipe(Effect.provide(layer))));
