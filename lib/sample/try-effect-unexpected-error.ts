import { Effect } from "effect";

const divide = (a: number, b: number) =>
  b === 0 ? Effect.dieMessage("cannot divide by zero") : Effect.succeed(a / b);

const program = divide(1, 0);
Effect.runPromise(program).catch(console.error);
