import { Effect, Context, Data } from "effect";

class SomeContext extends Context.Tag("SomeContext")<SomeContext, object>() {}
declare const _program: Effect.Effect<number, Error, SomeContext>;
type _A = Effect.Effect.Success<typeof _program>;
type _E = Effect.Effect.Error<typeof _program>;
type _R = Effect.Effect.Context<typeof _program>;

// Type signature doesn't show possible exceptions
const divide = (a: number, b: number): Effect.Effect<number, Error> =>
  b === 0
    ? Effect.fail(new Error("Cannot divide by zero"))
    : Effect.succeed(a / b);

console.log(divide(1, 0));
console.log(divide(1, 1));
const _success = Effect.succeed(42);
const _failure = Effect.fail(new Error("failed due to some error."));

class HttpError extends Data.TaggedError("HttpError")<object> {}
const _httpProgram = Effect.fail(new HttpError({}));
