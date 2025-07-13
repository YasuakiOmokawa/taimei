import { Effect, Context } from "effect";

export class MyLoggerService extends Context.Tag(
  "app/services/MyLoggerService"
)<
  MyLoggerService,
  { readonly log: (message: string) => Effect.Effect<void> }
>() {}
