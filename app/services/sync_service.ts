import { Effect, Random } from "effect";

export class SyncService extends Effect.Service<SyncService>()(
  "app/services/SyncService",
  {
    sync: () => ({
      next: Random.nextInt,
    }),
    accessors: true,
  }
) {}
