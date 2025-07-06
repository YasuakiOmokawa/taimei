import { Effect } from "effect";

const fail = Effect.fail("omg");
const die = Effect.dieMessage("runtime exit");

// use concurrency
const program = Effect.all([die, fail], {
  concurrency: "unbounded",
}).pipe(Effect.asVoid);
Effect.runPromiseExit(program).then(console.log);
