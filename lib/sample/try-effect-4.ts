import { pipe, Effect } from "effect";

const increment = (x: number) => x + 1;
const double = (x: number) => x * 2;
const subtractTen = (x: number) => x - 10;

const result = pipe(5, increment, double, subtractTen);
console.log(result);

const addServiceCarge = (amount: number) => amount + 1;

const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100));

const finalAmount = pipe(fetchTransactionAmount, Effect.map(addServiceCarge));

Effect.runPromise(finalAmount).then(console.log);

// as
const asProgram = pipe(Effect.succeed(5), Effect.as("new value"));
Effect.runPromise(asProgram).then(console.log);
