import { Effect, pipe, Console, Data, Random, Either } from "effect";

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

// use with type guard
interface User {
  readonly name: string;
}

type NullableUser = Promise<User | null>;
type AuthFunc = () => NullableUser;
const auth1: AuthFunc = () => Promise.resolve({ name: "taro1" });
const auth2: AuthFunc = () => Promise.resolve({ name: "taro2" });
const notAuth: AuthFunc = () => Promise.resolve(null);
const fetchAuthUserName = (authFunc: AuthFunc) =>
  pipe(
    Effect.promise(() => authFunc()),
    Effect.filterOrFail(
      (user): user is User => user != null,
      () => new Error("unauthorized")
    ),
    Effect.andThen((user) => user.name)
  );
const partitionAuth = Effect.partition([auth1, auth2, notAuth], (auth) =>
  fetchAuthUserName(auth)
);
Effect.runPromise(partitionAuth).then((res) =>
  console.log(`
    exclude    : ${res[0]}
    satisfying : ${res[1]}`)
);

// iife
await (async () => {
  const results = await Effect.runPromise(partitionAuth);
  console.log(`
    ############################################
    error results from effect  : ${results[0]}
    success result from effect : ${results[1]}
    ############################################
    `);
})();

// use tapError
const task: Effect.Effect<number, string> = Effect.fail("network error");
const tapping = Effect.tapError(task, (error) =>
  Console.log(`tapped error: ${error}`)
);
Effect.runFork(tapping);

// use tap by error tag
class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly statusCode: number;
}> {}
class ValidationError extends Data.TaggedError("ValidationError")<{
  readonly field: string;
}> {}

const networkErrorTask: Effect.Effect<number, NetworkError | ValidationError> =
  Effect.fail(new NetworkError({ statusCode: 504 }));

const taggedTapping = Effect.tapErrorTag(
  networkErrorTask,
  "NetworkError",
  (error) => Console.log(`tapped tagged error code: ${error.statusCode}`)
);
Effect.runFork(taggedTapping);

// use tap error by cause
const task1: Effect.Effect<number, string> = Effect.fail("network error");
const tappingByCause = Effect.tapErrorCause(task1, (cause) =>
  Console.log(`tapped by cause: ${cause}, tag: ${cause._tag}`)
);
Effect.runFork(tappingByCause);

const task2: Effect.Effect<number, string> = Effect.dieMessage("system error");
const tappingByCause2 = Effect.tapErrorCause(task2, (cause) =>
  Console.log(`tapped by cause: ${cause}, tag: ${cause._tag}`)
);
Effect.runFork(tappingByCause2);

// use tap defect error
const tappingDefect1 = Effect.tapDefect(task1, (cause) =>
  Console.log(`tapped defect1: ${cause}`)
);
Effect.runFork(tappingDefect1);

const tappingDefect2 = Effect.tapDefect(task2, (cause) =>
  Console.log(`tapped defect2: ${cause}`)
);
Effect.runFork(tappingDefect2);

// use tap both
const mightBeFailTask = Effect.filterOrFail(
  Random.nextRange(-1, 1),
  (n) => n >= 0,
  () => "random number is negative"
);

const tappingBoth = Effect.tapBoth(mightBeFailTask, {
  onFailure: (error) => Console.log(`error of both: ${error}`),
  onSuccess: (randomNumber) => Console.log(`success of both: ${randomNumber}`),
});
Effect.runFork(tappingBoth);

// use either
const failTask = Effect.fail("omg").pipe(Effect.as(2));
const recovered = Effect.gen(function* () {
  const failureOrSuccess = yield* Effect.either(failTask);

  if (Either.isLeft(failureOrSuccess)) {
    const error = failureOrSuccess.left;
    yield* Console.log(`left faulure: ${error}`);
    return 0;
  } else {
    const value = failureOrSuccess.right;
    yield* Console.log(`right success: ${value}`);
    return value;
  }
});
Effect.runPromise(recovered).then(console.log);

// use cause
const recoverByCause = Effect.gen(function* () {
  const cause = yield* Effect.cause(failTask);
  yield* Console.log(`recovered by cause: ${cause}, tag: ${cause._tag}`);
});
Effect.runPromise(recoverByCause).then(console.log);

// merge error into success
const recoverByMerge = Effect.merge(failTask).pipe(
  Effect.map((result) => `this is merged error message: ${result}`)
);
Effect.runPromise(recoverByMerge).then(console.log);

// use flip
const flipped = Effect.flip(failTask).pipe(
  Effect.map((result) => `this is flipped error as success: ${result}`)
);
Effect.runPromise(flipped).then(console.log);
