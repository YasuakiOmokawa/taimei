import { Effect } from "effect";

const program = Effect.sync(() => {
  console.log("hello,world");
  return 1;
});

const result = Effect.runSync(program);
console.log(result);
