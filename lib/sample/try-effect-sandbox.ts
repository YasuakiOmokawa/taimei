import { Effect, Console } from "effect";

const task = Effect.fail(new Error("omg")).pipe(Effect.as("as result"));

const sandboxed = Effect.sandbox(task);

const program = Effect.catchTags(sandboxed, {
  Die: (cause) =>
    Console.log(`caught a defect: ${cause.defect}`).pipe(
      Effect.as("fallback result on defect")
    ),
  Interrupt: (cause) =>
    Console.log(`caught a defect: ${cause.fiberId}`).pipe(
      Effect.as("fallback on fiber interruption")
    ),
  Fail: (cause) =>
    Console.log(`caught a defect: ${cause.error}`).pipe(
      Effect.as("fallback on failure")
    ),
});

const main = Effect.unsandbox(program);
Effect.runPromise(main).then(console.log);
