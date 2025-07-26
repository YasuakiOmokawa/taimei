import { CacheService } from "@/app/services/cache_service";
import { Effect, Console } from "effect";

const _layer = CacheService.Default;
const _layerNoDeps = CacheService.DefaultWithoutDependencies;

const program = Effect.gen(function* () {
  const cache = yield* CacheService;
  const data = yield* cache.lookup("my-key");
  console.log(data);
}).pipe(Effect.catchAllCause((cause) => Console.log(cause)));
const runnable = program.pipe(Effect.provide(CacheService.Default));
Effect.runFork(runnable);
