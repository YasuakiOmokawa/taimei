import { Effect } from "effect";

const addServiceCharge = (amount: number) => amount + 1;

const applyDiscount = (
  total: number,
  discountRate: number
): Effect.Effect<number, Error> =>
  discountRate === 0
    ? Effect.fail(new Error("this is cannot be zero"))
    : Effect.succeed(total - (total * discountRate) / 100);

const fetchTransactionAmount = Effect.promise(() => Promise.resolve(100));

const fetchDiscountRate = Effect.promise(() => Promise.resolve(5));

const program = Effect.gen(function* () {
  const transactionAmount = yield* fetchTransactionAmount;

  const discountRate = yield* fetchDiscountRate;

  const discountedAmount = yield* applyDiscount(
    transactionAmount,
    discountRate
  );

  const finalAmount = addServiceCharge(discountedAmount);

  return `Final ammount to charge: ${finalAmount}`;
});

Effect.runPromise(program).then(console.log);

const calculateTax = (
  amount: number,
  taxRate: number
): Effect.Effect<number, Error> =>
  taxRate > 0
    ? Effect.succeed((amount * taxRate) / 100)
    : Effect.fail(new Error("invalid tax rate"));

const taxProgram = Effect.gen(function* () {
  let i = 1;

  while (true) {
    if (i === 10) {
      break;
    } else {
      if (i % 2 === 0) {
        console.log(yield* calculateTax(100, i));
      }
      i++;
      continue;
    }
  }
});

Effect.runPromise(taxProgram);
