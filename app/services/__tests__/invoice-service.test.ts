import { expect } from "@effect/vitest";
import { eq } from "drizzle-orm";
import { Effect, Either } from "effect";
import { describe } from "vitest";
import { invoices } from "@/db/drizzle/schema";
import { companyFilter } from "@/db/scoped";
import { CompanyContext } from "../company-context";
import { InvoiceService } from "../invoice-service";
import { dbEffect } from "./db/effect-test-helpers";

// scoped Service は CompanyContext を要求するため、各テストは CompanyContext.layer を provide する。
// provide 漏れは ServiceLayer に CompanyContext が残りコンパイルエラー (閉じ1 backstop)。
const A = "cmp_aaa";
const B = "cmp_bbb";

describe("InvoiceService", () => {
  describe("fetchPages / fetchFiltered (空)", () => {
    dbEffect("正常系: データがない場合は0ページを返す", () =>
      Effect.gen(function* () {
        const service = yield* InvoiceService;
        const pages = yield* service.fetchPages("");
        expect(pages).toBe(0);
      }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );

    dbEffect("正常系: データがない場合は空配列を返す", () =>
      Effect.gen(function* () {
        const service = yield* InvoiceService;
        const list = yield* service.fetchFiltered("", 1);
        expect(list).toHaveLength(0);
      }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );
  });

  describe("scoping (cross-company 不可視)", () => {
    dbEffect(
      "findById: A context で B invoice は InvoiceNotFound (404)",
      ({ factory: f }) =>
        Effect.gen(function* () {
          const b = yield* Effect.promise(() =>
            f.invoice.create({ companyId: B }),
          );
          const service = yield* InvoiceService;
          const res = yield* Effect.either(service.findById(b.id));
          expect(Either.isLeft(res)).toBe(true);
          if (Either.isLeft(res)) expect(res.left._tag).toBe("InvoiceNotFound");
        }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );

    dbEffect(
      "fetchFiltered: A context は自社 invoice のみ返す",
      ({ factory: f }) =>
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
          const service = yield* InvoiceService;
          const list = yield* service.fetchFiltered("", 1);
          expect(list).toHaveLength(1);
          expect(list[0]?.name).toBe("Alice");
        }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );
  });

  describe("mutation IDOR", () => {
    dbEffect(
      "update: A context で B invoice id + 自社 customerId → InvoiceNotFound かつ B 行不変 (invoice scope 防御)",
      ({ factory: f, tx }) =>
        Effect.gen(function* () {
          // 自社 customerId を渡すことで customer 検証は通過させ、invoice 側の
          // companyFilter (WHERE) が他社 invoice を 0 行更新で防ぐことを固定する。
          const aCustomer = yield* Effect.promise(() =>
            f.customer.create({ companyId: A }),
          );
          const b = yield* Effect.promise(() =>
            f.invoice.create({ companyId: B, amount: 500 }),
          );
          const service = yield* InvoiceService;
          const res = yield* Effect.either(
            service.update({
              id: b.id,
              customerId: aCustomer.id,
              amount: 99999,
              status: "paid",
            }),
          );
          expect(Either.isLeft(res)).toBe(true);
          if (Either.isLeft(res)) expect(res.left._tag).toBe("InvoiceNotFound");
          // B 行が変更されていない (rows affected=0)。
          const rows = yield* Effect.promise(() =>
            tx
              .select({ amount: invoices.amount })
              .from(invoices)
              .where(eq(invoices.id, b.id)),
          );
          expect(rows[0]?.amount).toBe(500);
        }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );

    dbEffect(
      "delete: A context で B invoice → 404 かつ B 行不変",
      ({ factory: f, tx }) =>
        Effect.gen(function* () {
          const b = yield* Effect.promise(() =>
            f.invoice.create({ companyId: B }),
          );
          const service = yield* InvoiceService;
          const res = yield* Effect.either(service.delete(b.id));
          expect(Either.isLeft(res)).toBe(true);
          const rows = yield* Effect.promise(() =>
            tx
              .select({ id: invoices.id })
              .from(invoices)
              .where(eq(invoices.id, b.id)),
          );
          expect(rows).toHaveLength(1);
        }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );

    dbEffect(
      "create: A context で B customerId → 拒否 かつ A 行が作られない",
      ({ factory: f, tx }) =>
        Effect.gen(function* () {
          const bCustomer = yield* Effect.promise(() =>
            f.customer.create({ companyId: B }),
          );
          const service = yield* InvoiceService;
          const res = yield* Effect.either(
            service.create({
              customerId: bCustomer.id,
              amount: 100,
              status: "pending",
            }),
          );
          expect(Either.isLeft(res)).toBe(true);
          if (Either.isLeft(res))
            expect(res.left._tag).toBe("CustomerNotInScope");
          const rows = yield* Effect.promise(() =>
            tx
              .select({ id: invoices.id })
              .from(invoices)
              .where(companyFilter(invoices, A)),
          );
          expect(rows).toHaveLength(0);
        }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );

    dbEffect(
      "create: A context で A customerId → companyId=A が自動付与される",
      ({ factory: f }) =>
        Effect.gen(function* () {
          const aCustomer = yield* Effect.promise(() =>
            f.customer.create({ companyId: A }),
          );
          const service = yield* InvoiceService;
          const created = yield* service.create({
            customerId: aCustomer.id,
            amount: 100,
            status: "pending",
          });
          expect(created.companyId).toBe(A);
        }).pipe(Effect.provide(CompanyContext.layer({ companyId: A }))),
    );
  });
});
