import { Effect, Schedule, Console } from "effect";

const createCounter = () => {
  let val = 0;
  return {
    increment() {
      val++;
    },
    getVal() {
      return val;
    },
  };
};

const task = (counter: typeof createCounter.prototype) =>
  Effect.async<string, Error>((resume) => {
    if (counter.getVal() <= 2) {
      counter.increment();
      console.log("failure");
      resume(Effect.fail(new Error()));
    } else {
      console.log("success");
      resume(Effect.succeed("yay"));
    }
  });

// simple retry
const policy = Schedule.fixed("100 millis");
const repeated = Effect.retry(task(createCounter()), policy);
Effect.runPromise(repeated).then(console.log);

const addDelayPolicy = Schedule.addDelay(
  Schedule.recurs(2),
  () => "100 millis"
);
const delayRepeated = Effect.retryOrElse(
  task(createCounter()),
  addDelayPolicy,
  () => Console.log("orElse").pipe(Effect.as("this is default value"))
);
Effect.runPromise(delayRepeated).then(console.log);
