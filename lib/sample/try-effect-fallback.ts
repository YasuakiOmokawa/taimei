import { Effect } from "effect";

const success = Effect.succeed("success");
const failure = Effect.fail("failure");
const fallback = Effect.succeed("fallback");

// use orElse
const successProgram = Effect.orElse(success, () => fallback);
const fallbackProgram = Effect.orElse(failure, () => fallback);
Effect.runPromise(Effect.all([successProgram, fallbackProgram])).then(
  console.log
);

// use or else fail
const validate = (age: number): Effect.Effect<number, string> => {
  if (age < 0) {
    return Effect.fail("negative age error");
  } else if (age < 18) {
    return Effect.fail("illegal age error");
  } else {
    return Effect.succeed(age);
  }
};
const orElseFailProgram = Effect.orElseFail(validate(-1), () => "invalid age");
Effect.runPromiseExit(orElseFailProgram).then(console.log);

// use or else succeed
const orElseSuccessProgram = Effect.orElseSucceed(validate(-1), () => 18);
Effect.runPromiseExit(orElseSuccessProgram).then(console.log);
