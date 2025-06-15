import { Effect, Random, Data, Console, Either } from "effect";

class HttpError extends Data.TaggedError("HttpError")<{}> {}
class ValidationError extends Data.TaggedError("ValidationError")<{}> {}

const program = Effect.gen(function* () {
  const n1 = yield* Random.next;
  const n2 = yield* Random.next;

  if (n1 < 0.5) {
    return yield* Effect.fail(new HttpError());
  }
  if (n2 < 0.5) {
    return yield* Effect.fail(new ValidationError());
  }

  return "some result";
});

Effect.runPromise(program).then(console.log).catch(console.error);

const task1 = Console.log("task1");
const task2 = Effect.fail("this is fail");
const task3 = Console.log("task3");

const taskEffects = Effect.gen(function* () {
  yield* task1;
  return yield* task2;
  yield* task3;
});
Effect.runPromiseExit(taskEffects).then(console.log);

// use either
const recoveredEffect = Effect.gen(function* () {
  const failureOrSuccess = yield* Effect.either(program);
  return Either.match(failureOrSuccess, {
    onLeft: (error) => `recover from ${error._tag}`,
    onRight: (value) => `this is right result: ${value}`,
  });
});
Effect.runPromise(recoveredEffect).then(console.log);

// use optional type
const maybe1 = Effect.option(Effect.succeed(1));
const maybe2 = Effect.option(Effect.fail("this is fail."));
const maybe3 = Effect.option(Effect.die("Boom"));
Effect.runPromiseExit(Effect.all([maybe1, maybe2])).then(console.log);
Effect.runPromiseExit(Effect.all([maybe1, maybe2, maybe3])).then(console.log);

// use catchall
const recovered = program.pipe(
  Effect.catchAll((error) => Effect.succeed(`catchall from ${error._tag}`))
);
Effect.runPromise(recovered).then(console.log);
