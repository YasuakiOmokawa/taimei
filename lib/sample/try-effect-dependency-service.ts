import { CacheService } from "@/app/services/cache_service";
import { Effect, Console } from "effect";
import { FileSystem } from "@effect/platform";
import { SyncService } from "@/app/services/sync_service";

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

const runnableByTest = program.pipe(
  Effect.provide(CacheService.DefaultWithoutDependencies),
  Effect.provide(FileSystemTest)
);
Effect.runFork(runnableByTest);

// mocked cache service
const mockedCache = new CacheService({
  lookup: () => Effect.succeed("this is mocked cache content."),
});
const runnableByMock = program.pipe(
  Effect.provideService(CacheService, mockedCache)
);
Effect.runFork(runnableByMock);

// use direct method access
const programWithSync = Effect.gen(function* () {
  const n = yield* SyncService.next;
  console.log(`the number is: ${n}`);
});
Effect.runPromise(programWithSync.pipe(Effect.provide(SyncService.Default)));
