import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { describe } from "vitest";
import { CompanyContext } from "../company-context";
import { CustomerService } from "../customer-service";
import { dbEffect } from "./db/effect-test-helpers";

const A = "cmp_aaa";
const B = "cmp_bbb";

describe("CustomerService", () => {
  describe("findAll / fetchFiltered (空)", () => {
    dbEffect("正常系: 顧客がいない場合は空配列を返す", () =>
      Effect.gen(function* () {
        const service = yield* CustomerService;
        const customers = yield* service.findAll();
        expect(customers).toHaveLength(0);
      }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );

    dbEffect("正常系: 該当顧客がいない場合は空配列を返す", () =>
      Effect.gen(function* () {
        const service = yield* CustomerService;
        const customers = yield* service.fetchFiltered("alice");
        expect(customers).toHaveLength(0);
      }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );
  });

  describe("scoping (自社 customer のみ)", () => {
    dbEffect(
      "findAll は自社 customer のみ返す (dropdown に他社が出ない)",
      ({ factory: f }) =>
        Effect.gen(function* () {
          yield* Effect.promise(() =>
            f.customer.create({ companyId: A, name: "Alice" }),
          );
          yield* Effect.promise(() =>
            f.customer.create({ companyId: B, name: "Bob" }),
          );
          const service = yield* CustomerService;
          const list = yield* service.findAll();
          expect(list).toHaveLength(1);
          expect(list[0]?.name).toBe("Alice");
        }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );
  });

  describe("集計 leak 防止 (他社金額の混入なし)", () => {
    dbEffect(
      "fetchFiltered の totalPaid に他社 invoice 金額が混入しない",
      ({ factory: f }) =>
        Effect.gen(function* () {
          const aCustomer = yield* Effect.promise(() =>
            f.customer.create({ companyId: A, name: "Acme" }),
          );
          // 自社 (A) の paid invoice (500)。
          yield* Effect.promise(() =>
            f.invoice.create({
              companyId: A,
              customerId: aCustomer.id,
              status: "paid",
              amount: 500,
            }),
          );
          // 他社 (B) が A の customer を参照する stray invoice (factory で直接作成し service 検証を迂回)。
          // leftJoin の ON に companyFilter(invoices) が無いと totalPaid に 9999 が混入する。
          yield* Effect.promise(() =>
            f.invoice.create({
              companyId: B,
              customerId: aCustomer.id,
              status: "paid",
              amount: 9999,
            }),
          );
          const service = yield* CustomerService;
          const list = yield* service.fetchFiltered("Acme");
          expect(list).toHaveLength(1);
          expect(list[0]?.totalPaid).toBe(500);
        }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );
  });
});
