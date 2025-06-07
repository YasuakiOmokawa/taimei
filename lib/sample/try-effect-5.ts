import { Effect, Option, Console, Random } from "effect";

// use when
const validateWeightOption = (
  weight: number
): Effect.Effect<Option.Option<number>> =>
  Effect.succeed(weight).pipe(Effect.when(() => weight >= 0));

Effect.runPromise(Effect.forEach([-5, 1], (n) => validateWeightOption(n))).then(
  console.log
);

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

// use if
const flipTheCoin = Effect.if(Random.nextBoolean, {
  onTrue: () => Console.log("head"),
  onFalse: () => Console.log("tail"),
});
Effect.runFork(flipTheCoin);

const randomIntOption = Random.nextInt.pipe(
  Effect.whenEffect(Random.nextBoolean)
);
console.log(Effect.runSync(randomIntOption));
