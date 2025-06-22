import { Effect } from "effect";

const success: Effect.Effect<number, Error> = Effect.succeed(42);

// use match
const program1 = Effect.match(success, {
  onFailure: (error) => `failure: ${error.message}`,
  onSuccess: (value) => `success: ${value}`,
});
Effect.runPromise(program1).then(console.log);

const failure: Effect.Effect<number, Error> = Effect.fail(new Error("oh no!"));
const program2 = Effect.match(failure, {
  onFailure: (error) => `failure: ${error.message}`,
  onSuccess: (value) => `success: ${value}`,
});
Effect.runPromise(program2).then(console.log);
