import { describe } from "vitest";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { CustomerService } from "../customer-service";
import { dbEffect } from "./db/effect-test-helpers";

describe("CustomerService", () => {

  describe("findAll", () => {
    dbEffect("正常系: 顧客がいない場合は空配列を返す", () =>
      Effect.gen(function* () {
        const service = yield* CustomerService;
        const customers = yield* service.findAll();

        expect(customers).toHaveLength(0);
      })
    );
  });

  describe("fetchFiltered", () => {
    dbEffect("正常系: 顧客がいない場合は空配列を返す", () =>
      Effect.gen(function* () {
        const service = yield* CustomerService;
        const customers = yield* service.fetchFiltered("alice");

        expect(customers).toHaveLength(0);
      })
    );
  });
});
