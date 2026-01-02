import { describe, it, expect } from "vitest";
import { Effect, Either } from "effect";
import { CustomerService } from "../customer-service";
import {
  withRollback,
  useFactoryReset,
  runServiceWithTx,
} from "./db/test-helpers";

describe("CustomerService", () => {
  useFactoryReset();

  describe("findAll", () => {
    it("正常系: 顧客がいない場合は空配列を返す", async () => {
      await withRollback(async (tx) => {
        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* CustomerService;
            return yield* service.findAll();
          })
        );

        expect(Either.isRight(result)).toBe(true);
        if (Either.isRight(result)) {
          expect(result.right).toHaveLength(0);
        }
      });
    });
  });

  describe("fetchFiltered", () => {
    it("正常系: 顧客がいない場合は空配列を返す", async () => {
      await withRollback(async (tx) => {
        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* CustomerService;
            return yield* service.fetchFiltered("alice");
          })
        );

        expect(Either.isRight(result)).toBe(true);
        if (Either.isRight(result)) {
          expect(result.right).toHaveLength(0);
        }
      });
    });
  });
});
