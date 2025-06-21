import { Effect, Random, Data, Console, Either, Cause, Option } from "effect";

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
  Effect.catchAll((error) => Effect.succeed(`catchall from ${error}`))
);
Effect.runPromise(recovered).then(console.log);

// use cause
const recoveredByCause = program.pipe(
  Effect.catchAllCause((cause) =>
    Cause.isFailType(cause)
      ? Effect.succeed(`catchall cause by fail type ${cause.error._tag}`)
      : Effect.succeed("catch all cause by another fail")
  )
);
Effect.runPromise(recoveredByCause).then(console.log);

// use cause and catchall
const recoveredInCaseofCause = program.pipe(
  Effect.catchAllCause((cause) => {
    if (Cause.isFailType(cause)) {
      switch (cause.error._tag) {
        case "HttpError":
          return Effect.succeed("catch http error");
        case "ValidationError":
          return Effect.succeed("catch validation error");
        default:
          return Effect.succeed("catch another error");
      }
    } else {
      return Effect.succeed("this is not fail");
    }
  })
);
Effect.runPromise(recoveredInCaseofCause).then(console.log);

// handle error with either
const recoverWithEither = Effect.gen(function* () {
  const failureOrSuccess = yield* Effect.either(program);
  if (Either.isLeft(failureOrSuccess)) {
    const error = failureOrSuccess.left;
    if (error._tag === "HttpError") {
      return "recover httperror with either";
    } else {
      return yield* Effect.fail(error);
    }
  } else {
    return failureOrSuccess.right;
  }
});
Effect.runPromiseExit(recoverWithEither).then(console.log);

// handle all error with either
const recoverAllWithEither = Effect.gen(function* () {
  const failureOrSuccess = yield* Effect.either(program);
  if (Either.isLeft(failureOrSuccess)) {
    const error = failureOrSuccess.left;
    if (error._tag === "HttpError") {
      return "recover httperror with either ver.2";
    } else {
      return "recover validation error with either ver.2";
    }
  } else {
    return `this is ${failureOrSuccess.right} ver.2`;
  }
});
Effect.runPromise(recoverAllWithEither).then(console.log);

// handle error with catch some
const recoverBySome = program.pipe(
  Effect.catchSome((error) => {
    if (error._tag === "HttpError") {
      return Option.some(
        Effect.succeed("recover from http error wrapped with option")
      );
    } else {
      return Option.none();
    }
  })
);
Effect.runPromiseExit(recoverBySome).then(console.log);

// handle error with catch if
const recoverByIf = program.pipe(
  Effect.catchIf(
    (error) => error._tag === "HttpError",
    () => Effect.succeed("recover http error by catch if")
  )
);
Effect.runPromiseExit(recoverByIf).then(console.log);

// handle error with catch tag
const recoverWithCatchTag = program.pipe(
  Effect.catchTags({
    HttpError: (_HttpError) =>
      Effect.succeed("recover http error with catchtags"),
    ValidationError: (_ValidationError) =>
      Effect.succeed("catch validation error with catchtags"),
  })
);
Effect.runPromise(recoverWithCatchTag).then(console.log);

// use trace function
const myFunc = Effect.fn("myspan")(function* <N extends number>(n: N) {
  yield* Effect.annotateCurrentSpan("n", n);
  console.log(`got: ${n}`);
  return yield* Effect.fail(new Error("Boom!"));
});

Effect.runFork(myFunc(100).pipe(Effect.catchAllCause(Effect.logError)));
