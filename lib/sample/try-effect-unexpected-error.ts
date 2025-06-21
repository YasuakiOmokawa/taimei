import { Effect } from "effect";

const divide = (a: number, b: number) =>
  b === 0
    ? Effect.fail(new Error("cannot divide by zero"))
    : Effect.succeed(a / b);

const program = Effect.orDieWith(
  divide(1, 0),
  (error) => new Error(`detect: ${error.message}`)
);
Effect.runPromise(program).catch(console.error);
