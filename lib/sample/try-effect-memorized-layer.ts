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
