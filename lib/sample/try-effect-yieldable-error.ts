import { Effect, Data, Random } from "effect";

class FooError extends Data.TaggedError("FooError")<{
  message: string;
}> {}

class BarError extends Data.TaggedError("BarError")<{
  randomNumber: number;
}> {}

const program = Effect.gen(function* () {
  const n = yield* Random.next;
  return n > 0.5
    ? "yay"
    : n < 0.2
    ? yield* new FooError({ message: "omg" })
    : yield* new BarError({ randomNumber: n });
}).pipe(
  Effect.catchTags({
    FooError: (error) => Effect.succeed(`foo error: ${error.message}`),
    BarError: (error) => Effect.succeed(`bar error: ${error.randomNumber}`),
  })
);
Effect.runPromise(program).then(console.log);
