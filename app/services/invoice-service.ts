import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import { Effect } from "effect";
import { customers, invoices } from "@/db/drizzle/schema";
import { companyFilter } from "@/db/scoped";
import { CompanyContext } from "./company-context";
import {
  CustomerNotInScope,
  InvoiceNotFound,
  InvoiceServiceError,
} from "./invoice-errors";

export type CreateInvoiceInput = {
  customerId: string;
  amount: number;
  status: string;
};

export type UpdateInvoiceInput = {
  id: string;
  customerId: string;
  amount: number;
  status: string;
};

// 全 query は CompanyContext の companyId で scope する。設計詳細: docs/adr/0002-company-data-scoping.md。
export class InvoiceService extends Effect.Service<InvoiceService>()(
  "services/InvoiceService",
  {
    effect: Effect.gen(function* () {
      const pgdrizzle = yield* PgDrizzle.PgDrizzle;

      // customerId が自社 (companyId) に帰属するか検証する。
      // customers FK はグローバルなので、companyFilter で invoices を絞っても、他社 customerId を
      // 渡すと invoice が自社 companyId で作られる cross-company 参照注入になる。型・companyFilter
      // では塞がらないため mutation 入力 FK は明示検証する。設計詳細: docs/adr/0002-company-data-scoping.md。
      const assertCustomerInCompany = (customerId: string, companyId: string) =>
        Effect.gen(function* () {
          const owned = yield* Effect.tryPromise({
            try: () =>
              pgdrizzle
                .select({ id: customers.id })
                .from(customers)
                .where(
                  and(
                    eq(customers.id, customerId),
                    companyFilter(customers, companyId),
                  ),
                )
                .then((r) => r.at(0)),
            catch: (e) =>
              new InvoiceServiceError({
                message: `customer ownership check failed: ${e}`,
              }),
          });
          if (!owned) {
            // fail-open の本番検知系。正常 not-found と区別できる構造化ログを残す。
            console.error("cross-company write attempt", {
              kind: "invoice.customerId",
              attemptedCompanyId: companyId,
              targetCustomerId: customerId,
            });
            return yield* new CustomerNotInScope({ customerId });
          }
        });

      return {
        create: (input: CreateInvoiceInput) =>
          Effect.gen(function* () {
            const { companyId } = yield* CompanyContext;
            // companyId は引数ではなく context から付与する (取り違え防止)。
            yield* assertCustomerInCompany(input.customerId, companyId);
            return yield* Effect.tryPromise({
              try: () =>
                pgdrizzle
                  .insert(invoices)
                  .values({
                    customerId: input.customerId,
                    amount: input.amount,
                    status: input.status,
                    companyId,
                  })
                  .returning()
                  .then((res) => res[0]),
              catch: (e) =>
                new InvoiceServiceError({
                  message: `create failed: ${e}`,
                }),
            });
          }),

        update: (input: UpdateInvoiceInput) =>
          Effect.gen(function* () {
            const { companyId } = yield* CompanyContext;
            yield* assertCustomerInCompany(input.customerId, companyId);
            // 他社 id は companyFilter で除外され 0 行更新 → not-found (他社行は不変)。
            const result = yield* Effect.tryPromise({
              try: () =>
                pgdrizzle
                  .update(invoices)
                  .set({
                    customerId: input.customerId,
                    amount: input.amount,
                    status: input.status,
                  })
                  .where(
                    and(
                      eq(invoices.id, input.id),
                      companyFilter(invoices, companyId),
                    ),
                  )
                  .returning()
                  .then((res) => res.at(0)),
              catch: (e) =>
                new InvoiceServiceError({
                  message: `update failed: ${e}`,
                }),
            });
            if (!result) {
              return yield* new InvoiceNotFound({ id: input.id });
            }
            return result;
          }),

        delete: (id: string) =>
          Effect.gen(function* () {
            const { companyId } = yield* CompanyContext;
            // 他社 id は WHERE で 0 行 hit → returning 空 → 404 (rows affected=0、他社行を消さない)。
            const deleted = yield* Effect.tryPromise({
              try: () =>
                pgdrizzle
                  .delete(invoices)
                  .where(
                    and(
                      eq(invoices.id, id),
                      companyFilter(invoices, companyId),
                    ),
                  )
                  .returning({ id: invoices.id }),
              catch: (e) =>
                new InvoiceServiceError({
                  message: `delete failed: ${e}`,
                }),
            });
            if (deleted.length === 0) {
              return yield* new InvoiceNotFound({ id });
            }
          }),

        findById: (id: string) =>
          Effect.gen(function* () {
            const { companyId } = yield* CompanyContext;
            // 他社 id は WHERE で除外 → 空 → InvoiceNotFound (404 = 存在自体を隠蔽)。
            const result = yield* Effect.tryPromise({
              try: () =>
                pgdrizzle
                  .select({
                    id: invoices.id,
                    customerId: invoices.customerId,
                    amount: invoices.amount,
                    status: invoices.status,
                  })
                  .from(invoices)
                  .where(
                    and(
                      eq(invoices.id, id),
                      companyFilter(invoices, companyId),
                    ),
                  )
                  .then((res) => res.at(0)),
              catch: (e) =>
                new InvoiceServiceError({
                  message: `findById failed: ${e}`,
                }),
            });
            if (!result) {
              return yield* new InvoiceNotFound({ id });
            }
            return result;
          }),

        fetchFiltered: (query: string, currentPage: number, itemsPerPage = 6) =>
          Effect.gen(function* () {
            const { companyId } = yield* CompanyContext;
            return yield* Effect.tryPromise({
              try: () => {
                const offset = (currentPage - 1) * itemsPerPage;
                const searchPattern = `%${query}%`;

                return pgdrizzle
                  .select({
                    id: invoices.id,
                    amount: invoices.amount,
                    date: invoices.date,
                    status: invoices.status,
                    name: customers.name,
                    email: customers.email,
                    imageUrl: customers.imageUrl,
                  })
                  .from(invoices)
                  .innerJoin(customers, eq(invoices.customerId, customers.id))
                  .where(
                    and(
                      companyFilter(invoices, companyId),
                      or(
                        ilike(customers.name, searchPattern),
                        ilike(customers.email, searchPattern),
                        ilike(invoices.status, searchPattern),
                        sql`${invoices.amount}::text ILIKE ${searchPattern}`,
                        sql`${invoices.date}::text ILIKE ${searchPattern}`,
                      ),
                    ),
                  )
                  .orderBy(desc(invoices.date))
                  .limit(itemsPerPage)
                  .offset(offset);
              },
              catch: (e) =>
                new InvoiceServiceError({
                  message: `fetchFiltered failed: ${e}`,
                }),
            });
          }),

        fetchPages: (query: string, itemsPerPage = 6) =>
          Effect.gen(function* () {
            const { companyId } = yield* CompanyContext;
            return yield* Effect.tryPromise({
              try: async () => {
                const searchPattern = `%${query}%`;

                const result = await pgdrizzle
                  .select({ count: count() })
                  .from(invoices)
                  .innerJoin(customers, eq(invoices.customerId, customers.id))
                  .where(
                    and(
                      companyFilter(invoices, companyId),
                      or(
                        ilike(customers.name, searchPattern),
                        ilike(customers.email, searchPattern),
                        ilike(invoices.status, searchPattern),
                        sql`${invoices.amount}::text ILIKE ${searchPattern}`,
                        sql`${invoices.date}::text ILIKE ${searchPattern}`,
                      ),
                    ),
                  );

                return Math.ceil(Number(result[0].count) / itemsPerPage);
              },
              catch: (e) =>
                new InvoiceServiceError({
                  message: `fetchPages failed: ${e}`,
                }),
            });
          }),
      } as const;
    }),
  },
) {}
