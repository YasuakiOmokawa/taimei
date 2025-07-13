import { Context, Effect } from "effect";
import { MyRandomService } from "@/app/services/my_random_service";
import { MyLoggerService } from "@/app/services/my_logger_service";

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
