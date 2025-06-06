import { Effect, Option, pipe } from "effect";

const validateWeightOption = (
  weight: number
): Effect.Effect<Option.Option<number>> => {
  if (weight >= 0) {
    return Effect.succeed(Option.some(weight));
  } else {
    return Effect.succeed(Option.none());
  }
};

Effect.runPromise(validateWeightOption(5))
  .then(console.log)
  .catch(console.error);
Effect.runPromise(validateWeightOption(-1))
  .then(console.log)
  .catch(console.error);

const validateWeightOrFail = (
  weight: number
): Effect.Effect<number, string> => {
  if (weight >= 0) {
    return Effect.succeed(weight);
  } else {
    return Effect.fail(`negative input: ${weight}`);
  }
};

Effect.runPromiseExit(
  Effect.forEach([5, -1], (n) => validateWeightOrFail(n))
).then(console.log);
