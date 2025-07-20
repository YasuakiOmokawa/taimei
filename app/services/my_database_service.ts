import { Effect, Context } from "effect";

export class MyDatabaseService extends Context.Tag(
  "app/services/MyDatabaseService"
)<
  MyDatabaseService,
  {
    readonly query: (sql: string) => Effect.Effect<unknown>;
  }
>() {}
