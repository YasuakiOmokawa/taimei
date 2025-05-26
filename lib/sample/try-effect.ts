import { Effect, Context, Data } from "effect";

class SomeContext extends Context.Tag("SomeContext")<SomeContext, object>() {}
declare const _program: Effect.Effect<number, Error, SomeContext>;
type _A = Effect.Effect.Success<typeof _program>;
type _E = Effect.Effect.Error<typeof _program>;
type _R = Effect.Effect.Context<typeof _program>;

// Type signature doesn't show possible exceptions
const divide = (a: number, b: number): number => {
  if (b === 0) {
    throw new Error("Cannot divide by zero");
  }
  return a / b;
};

console.log(divide(1, 0));
const _success = Effect.succeed(42);
const _failure = Effect.fail(new Error("failed due to some error."));

class HttpError extends Data.TaggedError("HttpError")<object> {}
const _httpProgram = Effect.fail(new HttpError({}));
