import { Console, Effect } from "effect";

const handler = Effect.ensuring(Console.log("cleanup completed."));

// finalize on success
const success = Console.log("task completed").pipe(
  Effect.as("some result"),
  handler
);
Effect.runPromise(success).then(console.log);

// finalize on failure
const failure = Console.log("task failed").pipe(
  Effect.andThen(Effect.fail("some error")),
  handler
);
Effect.runPromise(failure).catch(console.error);
