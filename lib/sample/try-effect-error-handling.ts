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
  yield* task2;
  yield* task3;
});
Effect.runPromiseExit(taskEffects).then(console.log);

// use either
const recoveredEffect = Effect.gen(function* () {
  const failureOrSuccess = yield* Effect.either(program);
  if (Either.isLeft(failureOrSuccess)) {
    const error = failureOrSuccess.left;
    return `recover from ${error._tag}`;
  } else {
    return `this is right thing: ${failureOrSuccess.right}`;
  }
});
Effect.runPromise(recoveredEffect).then(console.log);
