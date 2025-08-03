import { CacheService } from "@/app/services/cache_service";
import { Effect, Console } from "effect";
import { FileSystem } from "@effect/platform";

const _layer = CacheService.Default;
const _layerNoDeps = CacheService.DefaultWithoutDependencies;

const program = Effect.gen(function* () {
  const cache = yield* CacheService;
  const data = yield* cache.lookup("my-key");
  console.log(data);
}).pipe(Effect.catchAllCause((cause) => Console.log(cause)));
const runnable = program.pipe(Effect.provide(CacheService.Default));
Effect.runFork(runnable);

const FileSystemTest = FileSystem.layerNoop({
  readFileString: () => Effect.succeed("this is mocked file content."),
});

const runnableAsTest = program.pipe(
  Effect.provide(CacheService.DefaultWithoutDependencies),
  Effect.provide(FileSystemTest)
);
Effect.runFork(runnableAsTest);
