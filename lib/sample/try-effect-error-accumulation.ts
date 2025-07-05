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

const forEachProgram = Effect.forEach([1, 2, 3, 4, 5], (n) => {
  if (n < 4) {
    return Console.log(`item: ${n}`).pipe(Effect.as(n));
  } else {
    return Effect.fail(`${n} is not less than 4`);
  }
});
Effect.runPromise(forEachProgram).then(console.log, console.error);
