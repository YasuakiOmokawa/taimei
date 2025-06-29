import { Effect } from "effect";
import { TimeoutException } from "effect/Cause";
import { Option } from "effect/Option";

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
