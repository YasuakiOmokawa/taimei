import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { describe } from "vitest";
import { IdGenerator } from "../id-generator-service";

describe("IdGenerator", () => {
  describe("Live", () => {
    it.effect("UUID v4 形式の文字列を生成する", () =>
      Effect.gen(function* () {
        const idGenerator = yield* IdGenerator;
        const id = yield* idGenerator.generate;

        const uuidV4Regex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        expect(id).toMatch(uuidV4Regex);
      }).pipe(Effect.provide(IdGenerator.Live)),
    );

    it.effect("呼び出すたびに異なるUUIDを生成する", () =>
      Effect.gen(function* () {
        const idGenerator = yield* IdGenerator;
        const id1 = yield* idGenerator.generate;
        const id2 = yield* idGenerator.generate;

        expect(id1).not.toBe(id2);
      }).pipe(Effect.provide(IdGenerator.Live)),
    );
  });

  describe("Test", () => {
    it.effect("固定値を返す", () =>
      Effect.gen(function* () {
        const idGenerator = yield* IdGenerator;
        const id = yield* idGenerator.generate;

        expect(id).toBe("0000****-000000000000");
      }).pipe(Effect.provide(IdGenerator.Test)),
    );

    it.effect("何度呼んでも同じ値を返す", () =>
      Effect.gen(function* () {
        const idGenerator = yield* IdGenerator;
        const id1 = yield* idGenerator.generate;
        const id2 = yield* idGenerator.generate;

        expect(id1).toBe("0000****-000000000000");
        expect(id2).toBe("0000****-000000000000");
      }).pipe(Effect.provide(IdGenerator.Test)),
    );
  });

  describe("TestSequence", () => {
    it.effect("連番のIDを生成する", () =>
      Effect.gen(function* () {
        const idGenerator = yield* IdGenerator;
        const id1 = yield* idGenerator.generate;
        const id2 = yield* idGenerator.generate;
        const id3 = yield* idGenerator.generate;

        expect([id1, id2, id3]).toEqual([
          "test-uuid-00000",
          "test-uuid-00001",
          "test-uuid-00002",
        ]);
      }).pipe(Effect.provide(IdGenerator.TestSequence)),
    );

    it.effect("カウンターは Layer ごとに独立している", () =>
      Effect.gen(function* () {
        // 最初の Layer
        const idGenerator = yield* IdGenerator;
        const id1 = yield* idGenerator.generate;
        expect(id1).toBe("test-uuid-00000");
      }).pipe(Effect.provide(IdGenerator.TestSequence)),
    );

    // Layer 間の独立性を別テストで検証
    it.effect("別の Layer でも最初から始まる", () =>
      Effect.gen(function* () {
        const idGenerator = yield* IdGenerator;
        const id = yield* idGenerator.generate;
        expect(id).toBe("test-uuid-00000");
      }).pipe(Effect.provide(IdGenerator.TestSequence)),
    );
  });

  describe("Custom", () => {
    it.effect("カスタムロジックでIDを生成する", () =>
      Effect.gen(function* () {
        const idGenerator = yield* IdGenerator;
        const id = yield* idGenerator.generate;

        expect(id).toBe("custom-id-12345");
      }).pipe(Effect.provide(IdGenerator.Custom(() => "custom-id-12345"))),
    );

    it.effect("タイムスタンプベースのID生成", () =>
      Effect.gen(function* () {
        const idGenerator = yield* IdGenerator;
        const id = yield* idGenerator.generate;

        expect(id).toMatch(/^id-\d+$/);
      }).pipe(Effect.provide(IdGenerator.Custom(() => `id-${Date.now()}`))),
    );
  });
});
