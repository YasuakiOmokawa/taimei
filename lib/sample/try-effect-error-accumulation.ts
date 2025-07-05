import { Effect, Console } from "effect";

const task1 = Console.log("task1").pipe(Effect.as(1));
const task2 = Effect.fail("omg").pipe(Effect.as(2));
const task3 = Console.log("task2").pipe(Effect.as(3));
const task4 = Effect.fail("omg2").pipe(Effect.as(4));

const program = task1.pipe(
  Effect.zip(task2),
  Effect.zip(task3),
  Effect.zip(task4)
);
Effect.runPromise(program).then(console.log, console.error);
