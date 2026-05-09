import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { describe } from "vitest";
import { DashboardService } from "../dashboard-service";
import { dbEffect } from "./db/effect-test-helpers";

describe("DashboardService", () => {
  describe("fetchCardData", () => {
    dbEffect("正常系: データがない場合はゼロ値を返す", () =>
      Effect.gen(function* () {
        const service = yield* DashboardService;
        const cardData = yield* service.fetchCardData();

        expect(cardData.numberOfCustomers).toBe(0);
        expect(cardData.numberOfInvoices).toBe(0);
        expect(cardData.totalPaidInvoices).toBe("$0.00");
        expect(cardData.totalPendingInvoices).toBe("$0.00");
      }),
    );
  });

  describe("fetchRevenue", () => {
    dbEffect("正常系: データがない場合は空配列を返す", () =>
      Effect.gen(function* () {
        const service = yield* DashboardService;
        const revenue = yield* service.fetchRevenue();

        expect(revenue).toHaveLength(0);
      }),
    );
  });

  describe("fetchLatestInvoices", () => {
    dbEffect("正常系: データがない場合は空配列を返す", () =>
      Effect.gen(function* () {
        const service = yield* DashboardService;
        const invoices = yield* service.fetchLatestInvoices();

        expect(invoices).toHaveLength(0);
      }),
    );
  });
});
