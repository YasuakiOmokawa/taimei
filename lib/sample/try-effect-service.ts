import { Effect } from "effect";
import { MyRandomService } from "@/app/services/my_random_service";

const program = Effect.gen(function* () {
  const random = yield* MyRandomService;
  const randomNumber = random.next;
  console.log(`random number: ${randomNumber}`);
});
Effect.runPromise(program).then(console.log);
