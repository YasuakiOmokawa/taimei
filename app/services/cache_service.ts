import { FileSystem } from "@effect/platform";
import { NodeFileSystem } from "@effect/platform-node";
import { Effect } from "effect";

export class CacheService extends Effect.Service<CacheService>()(
  "app/services/CacheService",
  {
    effect: Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const lookup = (key: string) => fs.readFileString(`cache/${key}`);
      return { lookup } as const;
    }),
    dependencies: [NodeFileSystem.layer],
  }
) {}
