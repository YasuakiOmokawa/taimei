import { Console, Effect } from "effect";

const handler = Effect.ensuring(Console.log("cleanup completed."));

const success = Console.log("task completed").pipe(
  Effect.as("some result"),
  handler
);
Effect.runPromise(success).then(console.log);
