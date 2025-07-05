import { Effect, Console } from "effect";

const task1 = Console.log("task1").pipe(Effect.as(1));
const task2 = Effect.fail("omg").pipe(Effect.as(2));
const task3 = Console.log("task2").pipe(Effect.as(3));
const task4 = Effect.fail("omg2").pipe(Effect.as(4));
const task5 = Effect.fail("omg3").pipe(Effect.as(5));

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

// use validate
const validateProgram = task1.pipe(
  Effect.validate(task2),
  Effect.validate(task3),
  Effect.validate(task4),
  Effect.validate(task5)
);
Effect.runPromiseExit(validateProgram).then(console.log);

// use validateAll
const validateAllProgram = Effect.validateAll([1, 2, 3, 4, 5], (n) => {
  if (n < 4) {
    return Console.log(`validate item: ${n}`).pipe(Effect.as(n));
  } else {
    return Effect.fail(`validate ${n} is not less than 4`);
  }
});
Effect.runPromiseExit(validateAllProgram).then(console.log);

// use validateFirst
const validateFirstProgram = Effect.validateFirst([1, 2, 3, 4, 5], (n) => {
  if (n < 4) {
    return Console.log(`first validate item: ${n}`).pipe(Effect.as(n));
  } else {
    return Effect.fail(`first validate ${n} is not less than 4`);
  }
});
Effect.runPromise(validateFirstProgram).then(console.log, console.error);

// use partition
const partitionProgram = Effect.partition([0, 1, 2, 3, 4], (n) => {
  if (n % 2 === 0) {
    return Effect.succeed(`partiton success: ${n}`);
  } else {
    return Effect.fail(`${n} is not even`);
  }
});
Effect.runPromise(partitionProgram).then(console.log, console.error);
