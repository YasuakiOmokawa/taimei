import { Effect, Console } from "effect";

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

// invoke error
const task1 = Console.log("task1..");
const task2 = Console.log("task2..");

const invokeErrorProgram = Effect.gen(function* () {
  yield* task1;
  yield* task2;
  yield* Effect.fail("something went wrong");
});

Effect.runPromise(invokeErrorProgram).then(console.log, console.error);

// invoke error 2
const task3 = Console.log("task3..");
const task4 = Console.log("task4..");
const failure = Effect.fail("hoge error");

const invokeErrorProgram2 = Effect.gen(function* () {
  yield* task1;
  yield* task2;
  yield* failure;
  yield* task3;
  yield* task4;
  return "some result";
});

Effect.runPromise(invokeErrorProgram2).then(console.log, console.error);

// extract type check
type User = {
  readonly name: string;
};

declare function getUserById(id: string): Effect.Effect<User | undefined>;

function _greetUser(id: string) {
  return Effect.gen(function* () {
    const user = yield* getUserById(id);

    if (user === undefined) {
      return yield* Effect.fail(`User with id ${id} not found`);
    }

    return `Hello, ${user.name}`;
  });
}

// access scope with this
class MyClass {
  readonly local = 1;
  compute = Effect.gen(this, function* () {
    const n = this.local + 1;

    yield* Effect.log(`computed value: ${n}`);

    return n;
  });
}

Effect.runPromise(new MyClass().compute).then(console.log);
