import { Context, Effect, Layer } from "effect";

/**
 * グローバル変数（crypto.randomUUID）をサービス化してテスタビリティを向上
 * Effect の Service Pattern に従い、依存性注入可能な形で実装
 */
export interface IdGeneratorService {
  readonly generate: Effect.Effect<string>;
}

export class IdGenerator extends Context.Tag("services/IdGenerator")<
  IdGenerator,
  IdGeneratorService
>() {
  /**
   * self.crypto は Node.js で未定義のため globalThis.crypto を使用
   * ブラウザと Node.js の両環境で統一的に動作させる必要がある
   */
  static Live = Layer.succeed(IdGenerator, {
    generate: Effect.sync(() => globalThis.crypto.randomUUID()),
  });

  /**
   * UUID 形式ではなく識別しやすい形式を採用（スナップショットテストの差分確認を容易にするため）
   */
  static Test = Layer.succeed(IdGenerator, {
    generate: Effect.succeed("0000****-000000000000"),
  });

  /**
   * Layer.sync でカウンターを Layer インスタンスごとに独立させ、テスト間の干渉を防ぐ
   * （複数のテストファイルで同時実行しても影響を受けない）
   */
  static TestSequence = Layer.sync(IdGenerator, () => {
    let counter = 0;
    return {
      generate: Effect.sync(() => {
        const id = `test-uuid-${String(counter).padStart(5, "0")}`;
        counter++;
        return id;
      }),
    };
  });

  /**
   * カスタムロジックを注入可能にする（特殊なテストケースで独自の ID 生成戦略が必要になる場合がある）
   */
  static Custom = (generator: () => string) =>
    Layer.succeed(IdGenerator, {
      generate: Effect.sync(generator),
    });
}
