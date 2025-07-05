import { Effect } from "effect";

const simulateTask = Effect.fail("omg").pipe(Effect.as(1));

// use mapError
const mapped = Effect.mapError(
  simulateTask,
  (message) => new Error(`this is mapped: ${message}`)
);
Effect.runPromise(mapped).catch(console.error);
