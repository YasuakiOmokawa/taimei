import { Effect, Random, Data } from "effect";

class HttpError extends Data.TaggedError("HttpError")<{}> {}

const program = Effect.gen(function* () {
  const n = yield* Random.next;

  if (n < 0.5) {
    return yield* Effect.fail(new HttpError());
  }

  return "some result";
});

Effect.runPromise(program).then(console.log).catch(console.error);
