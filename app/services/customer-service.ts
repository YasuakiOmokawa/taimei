import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { Effect } from "effect";
import { customers, invoices } from "@/db/drizzle/schema";
import { companyFilter } from "@/db/scoped";
import { CompanyContext } from "./company-context";
import { CustomerServiceError } from "./customer-errors";

// 全 query は CompanyContext の companyId で scope する。設計詳細: docs/adr/0002-company-data-scoping.md。
export class CustomerService extends Effect.Service<CustomerService>()(
  "services/CustomerService",
  {
    effect: Effect.gen(function* () {
      const pgdrizzle = yield* PgDrizzle.PgDrizzle;

      return {
        // invoice 作成 dropdown のソース。無 scope だと他社 customer が候補に出るため必ず scope する。
        findAll: () =>
          Effect.gen(function* () {
            const { companyId } = yield* CompanyContext;
            return yield* Effect.tryPromise({
              try: () =>
                pgdrizzle
                  .select({
                    id: customers.id,
                    name: customers.name,
                  })
                  .from(customers)
                  .where(companyFilter(customers, companyId))
                  .orderBy(customers.name),
              catch: (e) =>
                new CustomerServiceError({
                  message: `findAll failed: ${e}`,
                }),
            });
          }),

        fetchFiltered: (query: string) =>
          Effect.gen(function* () {
            const { companyId } = yield* CompanyContext;
            return yield* Effect.tryPromise({
              try: async () => {
                const searchPattern = `%${query}%`;

                const result = await pgdrizzle
                  .select({
                    id: customers.id,
                    name: customers.name,
                    email: customers.email,
                    imageUrl: customers.imageUrl,
                    totalInvoices: sql<number>`count(${invoices.id})`.as(
                      "total_invoices",
                    ),
                    totalPending:
                      sql<number>`sum(case when ${invoices.status} = 'pending' then ${invoices.amount} else 0 end)`.as(
                        "total_pending",
                      ),
                    totalPaid:
                      sql<number>`sum(case when ${invoices.status} = 'paid' then ${invoices.amount} else 0 end)`.as(
                        "total_paid",
                      ),
                  })
                  .from(customers)
                  // leftJoin の ON 句に invoices 側 companyFilter を AND する。
                  // customers を WHERE で絞っても join 先 invoices を絞らないと集計金額に
                  // 他社 invoice が混入する。
                  .leftJoin(
                    invoices,
                    and(
                      eq(customers.id, invoices.customerId),
                      companyFilter(invoices, companyId),
                    ),
                  )
                  .where(
                    and(
                      companyFilter(customers, companyId),
                      or(
                        ilike(customers.name, searchPattern),
                        ilike(customers.email, searchPattern),
                      ),
                    ),
                  )
                  .groupBy(
                    customers.id,
                    customers.name,
                    customers.email,
                    customers.imageUrl,
                  )
                  .orderBy(customers.name);

                return result.map((row) => ({
                  id: row.id,
                  name: row.name,
                  email: row.email,
                  imageUrl: row.imageUrl,
                  totalInvoices: Number(row.totalInvoices),
                  totalPending: Number(row.totalPending) || 0,
                  totalPaid: Number(row.totalPaid) || 0,
                }));
              },
              catch: (e) =>
                new CustomerServiceError({
                  message: `fetchFiltered failed: ${e}`,
                }),
            });
          }),
      } as const;
    }),
  },
) {}
