import { it } from "@effect/vitest";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { expect } from "vitest";
import { customers, invoices, revenue } from "@/db/drizzle/schema";
import { CompanyContext } from "../company-context";
import { dbEffect } from "./db/effect-test-helpers";

// PR-2 の機構基盤テスト。scoping 適用 (companyFilter を WHERE に入れる) は PR-3/4 で、
// ここでは factory が company_id を持つ行を生成できること + CompanyContext 注入を検証する。

dbEffect(
  "factory が company_id を持つ customer/invoice/revenue を生成・永続化する",
  ({ factory: f, tx }) =>
    Effect.gen(function* () {
      const customer = yield* Effect.promise(() =>
        f.customer.create({ companyId: "cmp_aaa" }),
      );
      expect(customer.companyId).toBe("cmp_aaa");

      // customerId 明示時は customer を関連生成せず渡した値を使う。
      const invoice = yield* Effect.promise(() =>
        f.invoice.create({ companyId: "cmp_aaa", customerId: customer.id }),
      );
      expect(invoice.companyId).toBe("cmp_aaa");
      expect(invoice.customerId).toBe(customer.id);

      const rev = yield* Effect.promise(() =>
        f.revenue.create({ companyId: "cmp_bbb", month: "2601" }),
      );
      expect(rev.companyId).toBe("cmp_bbb");

      // DB に company_id が永続化されていることを確認 (列が実在し書き込まれている)。
      const persisted = yield* Effect.promise(() =>
        tx
          .select({ id: customers.id, companyId: customers.companyId })
          .from(customers)
          .where(eq(customers.id, customer.id)),
      );
      expect(persisted[0]?.companyId).toBe("cmp_aaa");

      const persistedInvoice = yield* Effect.promise(() =>
        tx
          .select({ companyId: invoices.companyId })
          .from(invoices)
          .where(eq(invoices.id, invoice.id)),
      );
      expect(persistedInvoice[0]?.companyId).toBe("cmp_aaa");

      const persistedRevenue = yield* Effect.promise(() =>
        tx
          .select({ companyId: revenue.companyId })
          .from(revenue)
          .where(eq(revenue.month, "2601")),
      );
      expect(persistedRevenue[0]?.companyId).toBe("cmp_bbb");
    }),
);

it.effect("CompanyContext から注入した companyId を読める", () =>
  Effect.gen(function* () {
    const { companyId } = yield* CompanyContext;
    expect(companyId).toBe("cmp_zzz");
  }).pipe(Effect.provide(CompanyContext.layer({ companyId: "cmp_zzz" }))),
);
