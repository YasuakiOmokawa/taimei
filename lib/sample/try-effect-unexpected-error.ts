import { Effect, Cause, Console, Option, Exit } from "effect";

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

// use catchall
const catchAllDefectProgram = Effect.catchAllDefect(task, (defect) => {
  if (Cause.isRuntimeException(defect)) {
    return Console.log(
      `catch all runtimeexception defect caught: ${defect.message}`
    );
  }
  return Console.log(`catch all unknown defect caught`);
});
Effect.runPromiseExit(catchAllDefectProgram).then(console.log);

// use catchsome
const catchSomeProgram = Effect.catchSomeDefect(task, (defect) => {
  if (Cause.isIllegalArgumentException(defect)) {
    return Option.some(
      Console.log(
        `caught an IllegalArgumentException defect: ${defect.message}`
      )
    );
  }
  return Option.none();
});
Effect.runPromiseExit(catchSomeProgram).then(console.log);
