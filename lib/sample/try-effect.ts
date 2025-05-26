import { Effect, Context } from "effect";

class SomeContext extends Context.Tag("SomeContext")<SomeContext, object>() {}
declare const _program: Effect.Effect<number, Error, SomeContext>;
type _A = Effect.Effect.Success<typeof _program>;
type _E = Effect.Effect.Error<typeof _program>;
type _R = Effect.Effect.Context<typeof _program>;
