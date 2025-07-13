import { Effect, Context } from "effect";

export class MyRandomService extends Context.Tag(
  "app/services/MyRandomService"
)<MyRandomService, { readonly next: Effect.Effect<number> }>() {}
