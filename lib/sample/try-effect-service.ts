import { Effect } from "effect";
import { MyRandomService } from "@/app/services/my_random_service";

const program = Effect.gen(function* () {
  const random = yield* MyRandomService;
  const randomNumber = yield* random.next;
  console.log(`random number: ${randomNumber}`);
});

const runnable = Effect.provideService(program, MyRandomService, {
  next: Effect.sync(() => Math.random()),
});

Effect.runPromise(runnable);
