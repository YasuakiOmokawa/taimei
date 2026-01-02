import { describe, it, expect } from "vitest";
import { Effect, Either } from "effect";
import { InvoiceService } from "../invoice-service";
import {
  withRollback,
  useFactoryReset,
  runServiceWithTx,
} from "./db/test-helpers";

describe("InvoiceService", () => {
  useFactoryReset();

  describe("fetchPages", () => {
    it("正常系: データがない場合は0ページを返す", async () => {
      await withRollback(async (tx) => {
        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* InvoiceService;
            return yield* service.fetchPages("");
          })
        );

        expect(Either.isRight(result)).toBe(true);
        if (Either.isRight(result)) {
          expect(result.right).toBe(0);
        }
      });
    });
  });

  describe("fetchFiltered", () => {
    it("正常系: データがない場合は空配列を返す", async () => {
      await withRollback(async (tx) => {
        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* InvoiceService;
            return yield* service.fetchFiltered("", 1);
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
