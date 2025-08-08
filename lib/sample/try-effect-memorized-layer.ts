import { Effect, Context, Layer } from "effect";

class A extends Context.Tag("A")<A, { readonly a: number }>() {}
class B extends Context.Tag("B")<B, { readonly b: string }>() {}
class C extends Context.Tag("C")<C, { readonly c: boolean }>() {}

const ALive = Layer.effect(
  A,
  Effect.succeed({ a: 5 }).pipe(Effect.tap(() => Effect.log("a initialized")))
);

const BLive = Layer.effect(
  B,
  Effect.gen(function* () {
    const { a } = yield* A;
    return { b: String(a) };
  })
);

const CLive = Layer.effect(
  C,
  Effect.gen(function* () {
    const { a } = yield* A;
    return { c: a > 0 };
  })
);

const program = Effect.gen(function* () {
  const target = yield* B;
  const source = yield* C;
  return Object.assign(target, source);
});

const runnable = Effect.provide(
  program,
  Layer.merge(Layer.provide(BLive, ALive), Layer.provide(CLive, ALive))
);

Effect.runPromise(runnable).then((res) =>
  console.log(`${JSON.stringify(res)}\n===============`)
);

// use layer fresh
const runnableFresh = Effect.provide(
  program,
  Layer.merge(
    Layer.provide(BLive, Layer.fresh(ALive)),
    Layer.provide(CLive, Layer.fresh(ALive))
  )
);
Effect.runPromise(runnableFresh).then((res) =>
  console.log(`${JSON.stringify(res)}\n===============`)
);

// double program
const doubleProgram = Effect.gen(function* () {
  yield* Effect.provide(A, ALive);
  yield* Effect.provide(A, ALive);
});
Effect.runPromise(doubleProgram).then((res) =>
  console.log(`${JSON.stringify(res)}\n===============`)
);

// manual memoization
const memoizedProgram = Effect.scoped(
  Layer.memoize(ALive).pipe(
    Effect.andThen((memoized) =>
      Effect.gen(function* () {
        yield* Effect.provide(A, memoized);
        yield* Effect.provide(A, memoized);
      })
    )
  )
);
Effect.runPromise(memoizedProgram).then((res) =>
  console.log(`${JSON.stringify(res)}\n===============`)
);
