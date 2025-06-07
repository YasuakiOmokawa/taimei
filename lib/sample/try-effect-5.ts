import { Effect, Option, Console, Random, pipe, Iterable } from "effect";

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

// use zip
const task1 = Effect.succeed(1).pipe(
  Effect.delay("200 millis"),
  Effect.tap(Effect.log("task1 done"))
);

const task2 = Effect.succeed("hello").pipe(
  Effect.delay("100 millis"),
  Effect.tap(Effect.log("task2 done"))
);

const zipProgram = Effect.zip(task1, task2);
const zipProgramConcurrency = Effect.zip(task1, task2, { concurrent: true });
Effect.runPromise(
  Effect.all([zipProgram, zipProgramConcurrency], { concurrency: 2 })
).then(console.log);

// use zipWith
const task3 = Effect.zipWith(
  task1,
  task2,
  (number, string) => number + string.length
);

Effect.runPromise(
  Effect.all([zipProgram, zipProgramConcurrency, task3], { concurrency: 3 })
).then(console.log);

//use loop
const result = Effect.loop(1, {
  while: (state) => state <= 5,
  step: (state) => state + 1,
  body: (state) => Effect.succeed(state),
});
Effect.runPromise(result).then(console.log);

// use loop with discard
const result2 = Effect.loop(1, {
  while: (state) => state <= 5,
  step: (state) => state + 2,
  body: (state) => pipe(Effect.succeed(state), (result) => Console.log(result)),
  discard: true,
});
Effect.runPromise(result2).then(console.log);

// use iterate
const result3 = Effect.iterate(1, {
  while: (result) => result <= 6,
  body: (result) =>
    Effect.succeed(result + 1).pipe(
      Effect.tap((r) => Console.log(`result3 temp data: ${r}`))
    ),
});
Effect.runPromise(result3).then(console.log);

// use forEach
const result4 = Effect.forEach([1, 2, 3], (n, index) =>
  Console.log(`index: ${index}`).pipe(Effect.as(n * 2))
);
Effect.runPromise(result4).then(console.log);

// all iterable
const iterableOfEffects: Iterable<Effect.Effect<number>> = [1, 2, 3].map((n) =>
  Effect.succeed(n).pipe(Effect.tap(Console.log))
);

const resultsAsArray = Effect.all(iterableOfEffects);

Effect.runPromise(resultsAsArray).then(console.log);

// case struct
const structOfEffects = {
  a: Effect.succeed(1).pipe(
    Effect.tap((e) => Console.log(`struct of item a: ${e}`))
  ),
  b: Effect.succeed("A").pipe(
    Effect.tap((e) => Console.log(`struct of item b: ${e}`))
  ),
};

const resultAsStruct = Effect.all(structOfEffects);
Effect.runPromise(resultAsStruct).then(console.log);

// case record
const recordOfEffects: Record<string, Effect.Effect<number | string>> = {
  key1: Effect.succeed(1).pipe(
    Effect.tap((e) => Console.log(`record of key1: ${e}`))
  ),
  key2: Effect.succeed("A").pipe(
    Effect.tap((e) => Console.log(`record of key2: ${e}`))
  ),
};
const resultsAsRecord = Effect.all(recordOfEffects);
Effect.runPromise(resultsAsRecord).then(console.log);
