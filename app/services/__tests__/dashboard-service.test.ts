import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { describe } from "vitest";
import { CompanyContext } from "../company-context";
import { DashboardService } from "../dashboard-service";
import { dbEffect } from "./db/effect-test-helpers";

const A = "cmp_aaa";
const B = "cmp_bbb";

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
      }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );

    dbEffect(
      "集計 (件数・金額) が自社のみで他社が混入しない",
      ({ factory: f }) =>
        Effect.gen(function* () {
          const aCustomer = yield* Effect.promise(() =>
            f.customer.create({ companyId: A }),
          );
          yield* Effect.promise(() =>
            f.invoice.create({
              companyId: A,
              customerId: aCustomer.id,
              status: "paid",
              amount: 500,
            }),
          );
          const bCustomer = yield* Effect.promise(() =>
            f.customer.create({ companyId: B }),
          );
          yield* Effect.promise(() =>
            f.invoice.create({
              companyId: B,
              customerId: bCustomer.id,
              status: "paid",
              amount: 9999,
            }),
          );
          const service = yield* DashboardService;
          const cardData = yield* service.fetchCardData();

          expect(cardData.numberOfCustomers).toBe(1);
          expect(cardData.numberOfInvoices).toBe(1);
          // 500 のみ。他社 9999 が混入すると "$104.99" になる。
          expect(cardData.totalPaidInvoices).toBe("$5.00");
        }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );
  });

  describe("fetchRevenue", () => {
    dbEffect("正常系: データがない場合は空配列を返す", () =>
      Effect.gen(function* () {
        const service = yield* DashboardService;
        const revenue = yield* service.fetchRevenue();
        expect(revenue).toHaveLength(0);
      }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );

    dbEffect("自社の revenue のみ返す", ({ factory: f }) =>
      Effect.gen(function* () {
        yield* Effect.promise(() =>
          f.revenue.create({ companyId: A, month: "2601", revenue: 1000 }),
        );
        yield* Effect.promise(() =>
          f.revenue.create({ companyId: B, month: "2602", revenue: 2000 }),
        );
        const service = yield* DashboardService;
        const revenue = yield* service.fetchRevenue();
        expect(revenue).toHaveLength(1);
        expect(revenue[0]?.revenue).toBe(1000);
      }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );
  });

  describe("fetchLatestInvoices", () => {
    dbEffect("正常系: データがない場合は空配列を返す", () =>
      Effect.gen(function* () {
        const service = yield* DashboardService;
        const invoices = yield* service.fetchLatestInvoices();
        expect(invoices).toHaveLength(0);
      }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );

    dbEffect("自社の最新 invoice のみ返す", ({ factory: f }) =>
      Effect.gen(function* () {
        const aCustomer = yield* Effect.promise(() =>
          f.customer.create({ companyId: A, name: "Alice" }),
        );
        yield* Effect.promise(() =>
          f.invoice.create({ companyId: A, customerId: aCustomer.id }),
        );
        const bCustomer = yield* Effect.promise(() =>
          f.customer.create({ companyId: B, name: "Bob" }),
        );
        yield* Effect.promise(() =>
          f.invoice.create({ companyId: B, customerId: bCustomer.id }),
        );
        const service = yield* DashboardService;
        const invoices = yield* service.fetchLatestInvoices();
        expect(invoices).toHaveLength(1);
        expect(invoices[0]?.customer.name).toBe("Alice");
      }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );

    dbEffect(
      "他社 customer を参照する stray invoice は最新一覧に出ない (join scope)",
      ({ factory: f }) =>
        Effect.gen(function* () {
          const aCustomer = yield* Effect.promise(() =>
            f.customer.create({ companyId: A, name: "Alice" }),
          );
          yield* Effect.promise(() =>
            f.invoice.create({ companyId: A, customerId: aCustomer.id }),
          );
          // companyId は A だが customer が B 社の stray invoice。
          // join 先 customers の companyFilter で除外され顧客名が漏れない。
          const bCustomer = yield* Effect.promise(() =>
            f.customer.create({ companyId: B, name: "Bob" }),
          );
          yield* Effect.promise(() =>
            f.invoice.create({ companyId: A, customerId: bCustomer.id }),
          );
          const service = yield* DashboardService;
          const invoices = yield* service.fetchLatestInvoices();
          expect(invoices).toHaveLength(1);
          expect(invoices[0]?.customer.name).toBe("Alice");
        }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );
  });
});
