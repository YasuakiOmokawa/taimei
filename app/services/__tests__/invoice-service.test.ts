import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { describe } from "vitest";
import { InvoiceService } from "../invoice-service";
import { dbEffect } from "./db/effect-test-helpers";

describe("InvoiceService", () => {
  describe("fetchPages", () => {
    dbEffect("正常系: データがない場合は0ページを返す", () =>
      Effect.gen(function* () {
        const service = yield* InvoiceService;
        const pages = yield* service.fetchPages("");

        expect(pages).toBe(0);
      }),
    );
  });

  describe("fetchFiltered", () => {
    dbEffect("正常系: データがない場合は空配列を返す", () =>
      Effect.gen(function* () {
        const service = yield* InvoiceService;
        const invoices = yield* service.fetchFiltered("", 1);

        expect(invoices).toHaveLength(0);
      }),
    );
  });
});
