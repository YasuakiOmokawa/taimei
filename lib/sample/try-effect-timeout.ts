import { Effect } from "effect";
import { TimeoutException } from "effect/Cause";

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
