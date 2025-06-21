import { Effect, Cause, Console, Exit } from "effect";

const divide = (a: number, b: number) =>
  b === 0
    ? Effect.fail(new Error("cannot divide by zero"))
    : Effect.succeed(a / b);

const programDie = Effect.orDieWith(
  divide(1, 0),
  (error) => new Error(`detect: ${error.message}`)
);
Effect.runPromise(programDie).catch(console.error);

// use exit
const task = Effect.dieMessage("die!boom");
const program = Effect.gen(function* () {
  const exit = yield* Effect.exit(task);
  if (Exit.isFailure(exit)) {
    const cause = exit.cause;
    if (Cause.isDieType(cause) && Cause.isRuntimeException(cause.defect)) {
      yield* Console.log(
        `runtime exception defect caught: ${cause.defect.message}`
      );
    } else {
      yield* Console.log("unknown failure caught");
    }
  }
});
Effect.runPromiseExit(program).then(console.log);
