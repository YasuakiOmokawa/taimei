import { pipe, Effect, Option, Either } from "effect";

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

// flatMap
const applyDiscount = (
  total: number,
  discountRate: number
): Effect.Effect<number, Error> =>
  discountRate === 0
    ? Effect.fail(new Error("invalid of zero"))
    : Effect.succeed(total - (total * discountRate) / 100);

const fetchTransactionAmount2 = Effect.promise(() => Promise.resolve(100));

const finalAmount2 = pipe(
  fetchTransactionAmount2,
  Effect.flatMap((amount) => applyDiscount(amount, 5))
);

Effect.runPromise(finalAmount2).then(console.log).catch(console.error);

// use andThen
const resultWithoutAndThen = pipe(
  fetchTransactionAmount,
  Effect.flatMap((amount) => applyDiscount(amount, 1)),
  Effect.map((amount) => amount * 2)
);
Effect.runPromise(resultWithoutAndThen).then(console.log).catch(console.error);

const resultWithAndThen = pipe(
  fetchTransactionAmount,
  Effect.andThen((amount) => applyDiscount(amount, 1)),
  Effect.andThen((amount) => amount * 2)
);
Effect.runPromise(resultWithAndThen).then(console.log).catch(console.error);

//option, either
const fetchNumberValue = Effect.tryPromise(() => Promise.resolve(41));

const optionProgram = pipe(
  fetchNumberValue,
  Effect.andThen((x) => (x > 0 ? Option.some(x) : Option.none()))
);
Effect.runPromise(optionProgram).then(console.log);

const parseInteger = (input: string): Either.Either<number, string> =>
  isNaN(parseInt(input))
    ? Either.left("invalid integer")
    : Either.right(parseInt(input));

const fetchStringValue = Effect.tryPromise(() => Promise.resolve("あ"));

const parseProgram = pipe(
  fetchStringValue,
  Effect.andThen((str) => parseInteger(str))
);
Effect.runPromise(parseProgram).then(console.log).catch(console.error);
