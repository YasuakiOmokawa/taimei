import { Effect, Data, Cause, Either } from "effect";
import { TimeoutException } from "effect/Cause";
import { Option } from "effect/Option";
import { either } from "effect/RuntimeFlagsPatch";
import { string } from "zod/v4";

const task = Effect.gen(function* () {
  console.log("start processing...");
  yield* Effect.sleep("1 seconds");
  console.log("process complete!");
  return "Result";
});

// use timeout
const iterableEffects: Iterable<Effect.Effect<string, TimeoutException>> = [
  1, 0.5,
].map((n) => task.pipe(Effect.timeout(`${n} seconds`)));
const allEffects = Effect.all(iterableEffects, {
  mode: "validate",
});
Effect.runPromiseExit(allEffects).then((result) => console.log("%o", result));

// use timeout option
const iterableEffects2: Iterable<Effect.Effect<Option<string>>> = [
  1, 0.5, 2,
].map((n) => task.pipe(Effect.timeoutOption(`${n} seconds`)));
const allEffects2 = Effect.all(iterableEffects2);
Effect.runPromise(allEffects2).then(console.log);

// use disconnect
const longRunningTask = Effect.gen(function* () {
  console.log("start heavy processing...");
  yield* Effect.sleep("5 seconds");
  console.log("heavy processing done");
  return "Data processed";
});
//// non blocking, run at background
const uninterruptTask = longRunningTask.pipe(
  Effect.uninterruptible,
  Effect.disconnect,
  Effect.timeout("1 seconds")
);
Effect.runPromiseExit(uninterruptTask).then(console.log);

// use custom timeout fail
class MyTimeoutError extends Data.TaggedError("MyTimeoutError")<{}> {}

const timeoutFailProgram = task.pipe(
  Effect.timeoutFail({
    duration: "0.5 seconds",
    onTimeout: () => new MyTimeoutError(),
  })
);
Effect.runPromiseExit(timeoutFailProgram).then(console.log);

// use timeout cause
const timeoutCauseProgram = task.pipe(
  Effect.timeoutFailCause({
    duration: "0.5 seconds",
    onTimeout: () => Cause.die("caused by timed out"),
  })
);
Effect.runPromiseExit(timeoutCauseProgram).then(console.log);

// use timeout to
const timeoutToProgram = task.pipe(
  Effect.timeoutTo({
    duration: "0.5 seconds",
    onSuccess: (result): Either.Either<string, string> =>
      Either.right(`this is either result of ${result}`),
    onTimeout: (): Either.Either<string, string> => Either.left("to timed out"),
  })
);
Effect.runPromise(timeoutToProgram).then(console.log);
