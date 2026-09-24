import { Context, Effect, Layer } from "effect";

export class IdGenerator extends Context.Service<
  IdGenerator,
  { readonly generate: Effect.Effect<string> }
>()("services/IdGenerator") {
  // self.crypto は Node.js で未定義のため globalThis.crypto を使う
  static readonly layer = Layer.succeed(this, {
    generate: Effect.sync(() => globalThis.crypto.randomUUID()),
  });

  static readonly layerTest = Layer.succeed(this, {
    generate: Effect.succeed("0000****-000000000000"),
  });

  // Layer.sync でカウンターを Layer インスタンスごとに独立させ、テスト間の干渉を防ぐ
  static readonly layerTestSequence = Layer.sync(this, () => {
    let counter = 0;
    return {
      generate: Effect.sync(() => {
        const id = `test-uuid-${String(counter).padStart(5, "0")}`;
        counter++;
        return id;
      }),
    };
  });

  static readonly layerCustom = (generator: () => string) =>
    Layer.succeed(this, { generate: Effect.sync(generator) });
}
