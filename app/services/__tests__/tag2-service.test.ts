import { expect } from "@effect/vitest";
import { Effect, Either } from "effect";
import { describe } from "vitest";
import { CompanyContext } from "../company-context";
import { Tag2Service } from "../tag2-service";
import { dbEffect } from "./db/effect-test-helpers";

const A = "cmp_aaa";
const B = "cmp_bbb";

describe("Tag2Service", () => {
  describe("findAll (空)", () => {
    dbEffect("正常系: タグが無い場合は空配列を返す", () =>
      Effect.gen(function* () {
        const service = yield* Tag2Service;
        const tags = yield* service.findAll();
        expect(tags).toHaveLength(0);
      }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );
  });

  describe("scoping (社ごとのタグ辞書分離)", () => {
    dbEffect("findAll は自社のタグのみ返す", ({ factory: f }) =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          f.tag2.create({ companyId: A, name: "A社タグ" }),
        );
        yield* Effect.promise(() =>
          f.tag2.create({ companyId: B, name: "B社タグ" }),
        );
        const service = yield* Tag2Service;
        const tags = yield* service.findAll();
        expect(tags).toHaveLength(1);
        expect(tags[0]?.name).toBe("A社タグ");
      }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );

    dbEffect(
      "find: A context で B のタグは Tag2NotFound (404)",
      ({ factory: f }) =>
        Effect.gen(function* () {
          const b = yield* Effect.promise(() =>
            f.tag2.create({ companyId: B }),
          );
          const service = yield* Tag2Service;
          const res = yield* Effect.either(service.find(b.id));
          expect(Either.isLeft(res)).toBe(true);
          if (Either.isLeft(res)) expect(res.left._tag).toBe("Tag2NotFound");
        }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );

    dbEffect("find: A context で自社のタグは取得できる", ({ factory: f }) =>
      Effect.gen(function* () {
        const a = yield* Effect.promise(() =>
          f.tag2.create({ companyId: A, name: "自社タグ" }),
        );
        const service = yield* Tag2Service;
        const tag = yield* service.find(a.id);
        expect(tag.name).toBe("自社タグ");
      }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );
  });

  describe("id 検証", () => {
    dbEffect(
      "find: 不正な UUID は Tag2ParseError (DB cast エラー前に弾く)",
      () =>
        Effect.gen(function* () {
          const service = yield* Tag2Service;
          const res = yield* Effect.either(service.find("not-a-uuid"));
          expect(Either.isLeft(res)).toBe(true);
          if (Either.isLeft(res)) expect(res.left._tag).toBe("Tag2ParseError");
        }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );
  });
});
