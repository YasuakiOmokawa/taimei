import { Effect, pipe } from "effect";

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
