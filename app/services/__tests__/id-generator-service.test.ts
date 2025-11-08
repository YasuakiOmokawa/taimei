import { describe, it, expect } from "vitest";
import { Effect } from "effect";
import { IdGenerator } from "../id-generator-service";

describe("IdGenerator", () => {
  describe("Live", () => {
    it("UUID v4 形式の文字列を生成する", async () => {
      const program = Effect.gen(function* () {
        const idGenerator = yield* IdGenerator;
        return yield* idGenerator.generate;
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(IdGenerator.Live))
      );

      // UUID v4 形式の正規表現でバリデーション
      const uuidV4Regex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(result).toMatch(uuidV4Regex);
    });

    it("呼び出すたびに異なるUUIDを生成する", async () => {
      const program = Effect.gen(function* () {
        const idGenerator = yield* IdGenerator;
        const id1 = yield* idGenerator.generate;
        const id2 = yield* idGenerator.generate;
        return { id1, id2 };
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(IdGenerator.Live))
      );

      expect(result.id1).not.toBe(result.id2);
    });
  });

  describe("Test", () => {
    it("固定値を返す", async () => {
      const program = Effect.gen(function* () {
        const idGenerator = yield* IdGenerator;
        return yield* idGenerator.generate;
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(IdGenerator.Test))
      );

      expect(result).toBe("0000****-000000000000");
    });

    it("何度呼んでも同じ値を返す", async () => {
      const program = Effect.gen(function* () {
        const idGenerator = yield* IdGenerator;
        const id1 = yield* idGenerator.generate;
        const id2 = yield* idGenerator.generate;
        return { id1, id2 };
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(IdGenerator.Test))
      );

      expect(result.id1).toBe("0000****-000000000000");
      expect(result.id2).toBe("0000****-000000000000");
    });
  });

  describe("TestSequence", () => {
    it("連番のIDを生成する", async () => {
      const program = Effect.gen(function* () {
        const idGenerator = yield* IdGenerator;
        const id1 = yield* idGenerator.generate;
        const id2 = yield* idGenerator.generate;
        const id3 = yield* idGenerator.generate;
        return [id1, id2, id3];
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(IdGenerator.TestSequence))
      );

      expect(result).toEqual([
        "test-uuid-00000",
        "test-uuid-00001",
        "test-uuid-00002",
      ]);
    });

    it("カウンターは Layer ごとに独立している", async () => {
      const program1 = Effect.gen(function* () {
        const idGenerator = yield* IdGenerator;
        return yield* idGenerator.generate;
      });

      const program2 = Effect.gen(function* () {
        const idGenerator = yield* IdGenerator;
        return yield* idGenerator.generate;
      });

      // 別々の Layer で実行
      const result1 = await Effect.runPromise(
        program1.pipe(Effect.provide(IdGenerator.TestSequence))
      );
      const result2 = await Effect.runPromise(
        program2.pipe(Effect.provide(IdGenerator.TestSequence))
      );

      // 両方とも最初のIDから始まる
      expect(result1).toBe("test-uuid-00000");
      expect(result2).toBe("test-uuid-00000");
    });
  });

  describe("Custom", () => {
    it("カスタムロジックでIDを生成する", async () => {
      const customGenerator = () => "custom-id-12345";

      const program = Effect.gen(function* () {
        const idGenerator = yield* IdGenerator;
        return yield* idGenerator.generate;
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(IdGenerator.Custom(customGenerator)))
      );

      expect(result).toBe("custom-id-12345");
    });

    it("タイムスタンプベースのID生成", async () => {
      const timestampGenerator = () => `id-${Date.now()}`;

      const program = Effect.gen(function* () {
        const idGenerator = yield* IdGenerator;
        return yield* idGenerator.generate;
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(IdGenerator.Custom(timestampGenerator)))
      );

      expect(result).toMatch(/^id-\d+$/);
    });
  });
});
