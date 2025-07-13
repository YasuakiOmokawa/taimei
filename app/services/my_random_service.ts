import { Effect, Context } from "effect";

class MyRandomService extends Context.Tag("app/services/MyRandomService")<
  MyRandomService,
  { readonly next: Effect.Effect<number> }
>() {}
