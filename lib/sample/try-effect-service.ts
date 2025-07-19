import { Context, Effect, Option, Clock, Console } from "effect";
import { MyRandomService } from "@/app/services/my_random_service";
import { MyLoggerService } from "@/app/services/my_logger_service";
import { MyDatabaseService } from "@/app/services/my_database_service";

const program = Effect.gen(function* () {
  const random = yield* MyRandomService;
  const logger = yield* MyLoggerService;

  const randomNumber = yield* random.next;
  yield* logger.log(String(randomNumber));
});

const runnable = program.pipe(
  Effect.provideService(MyRandomService, {
    next: Effect.sync(() => Math.random()),
  }),
  Effect.provideService(MyLoggerService, {
    log: (message) => Effect.sync(() => console.log(message)),
  })
);

Effect.runPromise(runnable);

// use tag service
type _MyRandomType = Context.Tag.Service<MyRandomService>;

// use context
const context = Context.empty().pipe(
  Context.add(MyRandomService, { next: Effect.sync(() => Math.random()) }),
  Context.add(MyLoggerService, {
    log: (message) => Effect.sync(() => console.log(message)),
  })
);
const runnableWithContext = Effect.provide(program, context);
Effect.runPromise(runnableWithContext);

// optional service
const optionalProgram = Effect.gen(function* () {
  const maybeRandom = yield* Effect.serviceOption(MyRandomService);
  const randomNumber = Option.isNone(maybeRandom)
    ? -1
    : yield* maybeRandom.value.next;
  const valueDescriptionMessage = Option.isNone(maybeRandom)
    ? `this is not provided version: ${randomNumber}`
    : `this is provided version: ${randomNumber}`;
  console.log(valueDescriptionMessage);
});
Effect.runPromise(optionalProgram);
Effect.runPromise(
  Effect.provideService(optionalProgram, MyRandomService, {
    next: Effect.sync(() => Math.random()),
  })
);

// use default service
const programWithDefaultService = Effect.gen(function* () {
  const now = yield* Clock.currentTimeMillis;
  yield* Console.log(`application started at ${new Date(now)}}`);
});
Effect.runFork(programWithDefaultService);

// use test instance
const DatabaseTest = MyDatabaseService.of({
  query: (_sql: string) => Effect.succeed([]),
});
import * as assert from "node:assert";
const test = Effect.gen(function* () {
  const database = yield* MyDatabaseService;
  const result = yield* database.query("select * from users");
  assert.deepStrictEqual(result, []);
});
const _incompleteTestSetup = test.pipe(
  Effect.provideService(MyDatabaseService, DatabaseTest)
);
