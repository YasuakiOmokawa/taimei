import { Context, Effect, Layer } from "effect";

/**
 * グローバル変数（crypto.randomUUID）をサービス化してテスタビリティを向上
 * Effect の Service Pattern に従い、依存性注入可能な形で実装
 */
export interface IdGeneratorService {
  readonly generate: Effect.Effect<string>;
}

export class IdGenerator extends Context.Tag("IdGenerator")<
  IdGenerator,
  IdGeneratorService
>() {
  /**
   * globalThis.crypto を使用する理由：
   * - ブラウザと Node.js の両環境で動作する統一的な API
   * - self.crypto は Node.js で未定義のため使用不可
   */
  static Live = Layer.succeed(IdGenerator, {
    generate: Effect.sync(() => globalThis.crypto.randomUUID()),
  });

  /**
   * スナップショットテストで毎回同じ結果を保証するため固定値を返す
   * 可読性のため UUID 形式ではなく識別しやすい形式を採用
   */
  static Test = Layer.succeed(IdGenerator, {
    generate: Effect.succeed("0000****-000000000000"),
  });

  /**
   * 複数アカウント作成など、異なる ID が必要なテストシナリオのため連番を生成
   * Layer.sync でカウンターを Layer インスタンスごとに独立させ、テスト間の干渉を防ぐ
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
   * 特殊なテストシナリオ（タイムスタンプベース等）のため、
   * カスタムロジックを注入可能にする
   */
  static Custom = (generator: () => string) =>
    Layer.succeed(IdGenerator, {
      generate: Effect.sync(generator),
    });
}
