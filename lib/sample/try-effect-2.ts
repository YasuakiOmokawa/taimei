import { Effect, Console, Schedule, Fiber } from "effect";

const program = Effect.sync(() => {
  console.log("hello,world");
  return 1;
});

const result = Effect.runSync(program);
console.log(result);

Effect.runPromise(Effect.succeed(1)).then(console.log);
Effect.runPromise(Effect.fail("error")).catch(console.error);

Effect.runPromiseExit(Effect.succeed(1)).then(console.log);
Effect.runPromiseExit(Effect.fail("error")).then(console.log);

const fiberProgram = Effect.repeat(
  Console.log("running..."),
  Schedule.spaced("200 millis")
);

const fiber = Effect.runFork(fiberProgram);

setTimeout(() => {
  Effect.runFork(Fiber.interrupt(fiber));
}, 500);
