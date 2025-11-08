import { describe, it, expect } from "vitest";
import { Effect, Either } from "effect";
import { IdGenerator } from "../id-generator-service";
import { runWithLayer } from "./test-helpers";

describe("IdGenerator", () => {
  describe("Live", () => {
    it("UUID v4 形式の文字列を生成する", async () => {
      const result = await runWithLayer(
        Effect.gen(function* () {
          const idGenerator = yield* IdGenerator;
          return yield* idGenerator.generate;
        }),
        IdGenerator.Live
      );

      // UUID v4 形式の正規表現でバリデーション
      const uuidV4Regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toMatch(uuidV4Regex);
      }
    });

    it("呼び出すたびに異なるUUIDを生成する", async () => {
      const result = await runWithLayer(
        Effect.gen(function* () {
          const idGenerator = yield* IdGenerator;
          const id1 = yield* idGenerator.generate;
          const id2 = yield* idGenerator.generate;
          return { id1, id2 };
        }),
        IdGenerator.Live
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right.id1).not.toBe(result.right.id2);
      }
    });
  });

  describe("Test", () => {
    it("固定値を返す", async () => {
      const result = await runWithLayer(
        Effect.gen(function* () {
          const idGenerator = yield* IdGenerator;
          return yield* idGenerator.generate;
        }),
        IdGenerator.Test
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toBe("0000****-000000000000");
      }
    });

    it("何度呼んでも同じ値を返す", async () => {
      const result = await runWithLayer(
        Effect.gen(function* () {
          const idGenerator = yield* IdGenerator;
          const id1 = yield* idGenerator.generate;
          const id2 = yield* idGenerator.generate;
          return { id1, id2 };
        }),
        IdGenerator.Test
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right.id1).toBe("0000****-000000000000");
        expect(result.right.id2).toBe("0000****-000000000000");
      }
    });
  });

  describe("TestSequence", () => {
    it("連番のIDを生成する", async () => {
      const result = await runWithLayer(
        Effect.gen(function* () {
          const idGenerator = yield* IdGenerator;
          const id1 = yield* idGenerator.generate;
          const id2 = yield* idGenerator.generate;
          const id3 = yield* idGenerator.generate;
          return [id1, id2, id3];
        }),
        IdGenerator.TestSequence
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toEqual([
          "test-uuid-00000",
          "test-uuid-00001",
          "test-uuid-00002",
        ]);
      }
    });

    it("カウンターは Layer ごとに独立している", async () => {
      const program = Effect.gen(function* () {
        const idGenerator = yield* IdGenerator;
        return yield* idGenerator.generate;
      });

      // 別々の Layer で実行
      const result1 = await runWithLayer(program, IdGenerator.TestSequence);
      const result2 = await runWithLayer(program, IdGenerator.TestSequence);

      // 両方とも最初のIDから始まる
      expect(Either.isRight(result1)).toBe(true);
      expect(Either.isRight(result2)).toBe(true);
      if (Either.isRight(result1) && Either.isRight(result2)) {
        expect(result1.right).toBe("test-uuid-00000");
        expect(result2.right).toBe("test-uuid-00000");
      }
    });
  });

  describe("Custom", () => {
    it("カスタムロジックでIDを生成する", async () => {
      const customGenerator = () => "custom-id-12345";

      const result = await runWithLayer(
        Effect.gen(function* () {
          const idGenerator = yield* IdGenerator;
          return yield* idGenerator.generate;
        }),
        IdGenerator.Custom(customGenerator)
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toBe("custom-id-12345");
      }
    });

    it("タイムスタンプベースのID生成", async () => {
      const timestampGenerator = () => `id-${Date.now()}`;

      const result = await runWithLayer(
        Effect.gen(function* () {
          const idGenerator = yield* IdGenerator;
          return yield* idGenerator.generate;
        }),
        IdGenerator.Custom(timestampGenerator)
      );

      expect(Either.isRight(result)).toBe(true);
      if (Either.isRight(result)) {
        expect(result.right).toMatch(/^id-\d+$/);
      }
    });
  });
});
