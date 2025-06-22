import { Effect } from "effect";

const success: Effect.Effect<number, Error> = Effect.succeed(42);

// use match
const program1 = Effect.match(success, {
  onFailure: (error) => `failure: ${error.message}`,
  onSuccess: (value) => `success: ${value}`,
});
Effect.runPromise(program1).then(console.log);

const failure: Effect.Effect<number, Error> = Effect.fail(new Error("oh no!"));
const program2 = Effect.match(failure, {
  onFailure: (error) => `failure: ${error.message}`,
  onSuccess: (value) => `success: ${value}`,
});
Effect.runPromise(program2).then(console.log);

// use ignore
const task = Effect.fail("oh no").pipe(Effect.as(5));
const voidProgram = Effect.ignore(task);
Effect.runPromise(voidProgram).then(console.log);

// use match effect
const matchEffectProgram1 = Effect.matchEffect(success, {
  onFailure: (error) =>
    Effect.succeed(`error: ${error.message}`).pipe(Effect.tap(Effect.log)),
  onSuccess: (value) =>
    Effect.succeed(`success: ${value}`).pipe(Effect.tap(Effect.log)),
});

const matchEffectProgram2 = Effect.matchEffect(failure, {
  onFailure: (error) =>
    Effect.succeed(`error: ${error.message}`).pipe(Effect.tap(Effect.log)),
  onSuccess: (value) =>
    Effect.succeed(`success: ${value}`).pipe(Effect.tap(Effect.log)),
});

Effect.runPromise(Effect.all([matchEffectProgram1, matchEffectProgram2])).then(
  console.log
);

// conflict this
const _hoge2 = "fuga2";
