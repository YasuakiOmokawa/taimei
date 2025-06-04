import { Effect, Context, Data, Fiber } from "effect";

class SomeContext extends Context.Tag("SomeContext")<SomeContext, object>() {}
declare const _program: Effect.Effect<number, Error, SomeContext>;
type _A = Effect.Effect.Success<typeof _program>;
type _E = Effect.Effect.Error<typeof _program>;
type _R = Effect.Effect.Context<typeof _program>;

// Type signature doesn't show possible exceptions
const divide = (a: number, b: number): Effect.Effect<number, Error> =>
  b === 0
    ? Effect.fail(new Error("Cannot divide by zero"))
    : Effect.succeed(a / b);

console.log(divide(1, 0));
console.log(divide(1, 1));
const _success = Effect.succeed(42);
const _failure = Effect.fail(new Error("failed due to some error."));

class HttpError extends Data.TaggedError("HttpError")<object> {}
const _httpProgram = Effect.fail(new HttpError({}));

interface User {
  readonly id: number;
  readonly name: string;
}
const getUser = (userId: number): Effect.Effect<User, Error> => {
  const userDatabase: Record<number, User> = {
    1: { id: 1, name: "taro" },
    2: { id: 2, name: "kumi" },
  };

  const user = userDatabase[userId];
  if (user) {
    return Effect.succeed(user);
  } else {
    return Effect.fail(new Error("User not found"));
  }
};

const successUserEffect = getUser(1);
const failedUserEffect = getUser(0);
console.table({
  success: successUserEffect,
  fail: failedUserEffect,
});

const jsonParse = (input: string) =>
  Effect.try({
    try: () => JSON.parse(input),
    catch: (unknown) => new Error(`unexpected error ${unknown}`),
  });

const failParseProgram = jsonParse("");
const successParseProgram = jsonParse("{a:'b'}");
console.table({
  f: failParseProgram,
  s: successParseProgram,
});

const getTodo = (id: number) =>
  Effect.tryPromise({
    try: () => fetch(`https://jsonplaceholder.typicode.com/todos/${id}`),
    catch: (unknown) => new Error(`todo not found: ${unknown}`),
  });

const successGetTodo = getTodo(1);
const failGetTodo = getTodo(0);
console.table({
  f: failGetTodo,
  s: successGetTodo,
});

// abort signal sample
const interruptibleTask = Effect.async<void, Error>((resume, signal) => {
  signal.addEventListener("abort", () => {
    console.log("abort signal received");
    clearTimeout(timeoutId);
  });

  const timeoutId = setTimeout(() => {
    console.log("operation completed");
    resume(Effect.void);
  }, 1000);
});

const fiberProgram = Effect.gen(function* () {
  const fiber = yield* Effect.fork(interruptibleTask);
  // yield* Effect.sleep("1 second");
  yield* Fiber.interrupt(fiber);
});

Effect.runPromise(fiberProgram);

// 遅延評価
let i = 0;
const bad = Effect.succeed(i++);
const good = Effect.suspend(() => Effect.succeed(i++));

console.log(Effect.runSync(bad));
console.log(Effect.runSync(bad));
console.log(Effect.runSync(good));
console.log(Effect.runSync(good));
console.log(i);
