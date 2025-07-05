import { Effect } from "effect";

const simulateTask = Effect.fail("omg").pipe(Effect.as(1));

// use mapError
const mapped = Effect.mapError(
  simulateTask,
  (message) => new Error(`this is mapped: ${message}`)
);
Effect.runPromise(mapped).catch(console.error);

// use mapBoth
const mapBoth = Effect.mapBoth(simulateTask, {
  onSuccess: (value) => value > 0,
  onFailure: (message) => new Error(`this is both mapped: ${message}`),
});
Effect.runPromise(mapBoth).catch(console.error);
