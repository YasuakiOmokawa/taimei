import { Effect, pipe, Console, Data } from "effect";

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

type AuthFunc = () => Promise<User | null>;
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
const partitionAuth = Effect.partition([auth1, auth2, notAuth], (n) =>
  fetchAuthUserName(n)
);
Effect.runPromise(partitionAuth).then((res) =>
  console.log(`
    exclude    : ${res[0]}
    satisfying : ${res[1]}`)
);

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
