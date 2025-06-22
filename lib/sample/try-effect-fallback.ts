import { Effect } from "effect";

const success = Effect.succeed("success");
const failure = Effect.fail("failure");
const fallback = Effect.succeed("fallback");

// use orElse
const successProgram = Effect.orElse(success, () => fallback);
const fallbackProgram = Effect.orElse(failure, () => fallback);
Effect.runPromise(Effect.all([successProgram, fallbackProgram])).then(
  console.log
);
