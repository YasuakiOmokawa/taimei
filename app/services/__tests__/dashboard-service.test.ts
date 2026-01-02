import { describe, it, expect } from "vitest";
import { Effect, Either } from "effect";
import { DashboardService } from "../dashboard-service";
import {
  withRollback,
  useFactoryReset,
  runServiceWithTx,
} from "./db/test-helpers";

describe("DashboardService", () => {
  useFactoryReset();

  describe("fetchCardData", () => {
    it("正常系: データがない場合はゼロ値を返す", async () => {
      await withRollback(async (tx) => {
        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* DashboardService;
            return yield* service.fetchCardData();
          })
        );

        expect(Either.isRight(result)).toBe(true);
        if (Either.isRight(result)) {
          expect(result.right.numberOfCustomers).toBe(0);
          expect(result.right.numberOfInvoices).toBe(0);
          expect(result.right.totalPaidInvoices).toBe("$0.00");
          expect(result.right.totalPendingInvoices).toBe("$0.00");
        }
      });
    });
  });

  describe("fetchRevenue", () => {
    it("正常系: データがない場合は空配列を返す", async () => {
      await withRollback(async (tx) => {
        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* DashboardService;
            return yield* service.fetchRevenue();
          })
        );

        expect(Either.isRight(result)).toBe(true);
        if (Either.isRight(result)) {
          expect(result.right).toHaveLength(0);
        }
      });
    });
  });

  describe("fetchLatestInvoices", () => {
    it("正常系: データがない場合は空配列を返す", async () => {
      await withRollback(async (tx) => {
        const result = await runServiceWithTx(
          tx,
          Effect.gen(function* () {
            const service = yield* DashboardService;
            return yield* service.fetchLatestInvoices();
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
