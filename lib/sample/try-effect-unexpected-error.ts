import { Effect } from "effect";

const divide = (a: number, b: number) =>
  b === 0
    ? Effect.fail(new Error("cannot divide by zero"))
    : Effect.succeed(a / b);

const program = Effect.orDie(divide(1, 0));
Effect.runPromise(program).catch(console.error);
