import { Effect, Schedule } from "effect";

let count = 0;

const task = Effect.async<string, Error>((resume) => {
  if (count <= 2) {
    count++;
    console.log("failure");
    resume(Effect.fail(new Error()));
  } else {
    console.log("success");
    resume(Effect.succeed("yay"));
  }
});

// simple retry
const policy = Schedule.fixed("100 millis");
const repeated = Effect.retry(task, policy);
Effect.runPromise(repeated).then(console.log);
