import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { Data, Effect } from "effect";
import { customers, invoices } from "@/db/drizzle/schema";
import { eq, or, ilike, sql } from "drizzle-orm";

export class CustomerServiceError extends Data.TaggedError(
  "CustomerServiceError"
)<{
  message: string;
}> {}

export class CustomerService extends Effect.Service<CustomerService>()(
  "services/CustomerService",
  {
    effect: Effect.gen(function* () {
      const pgdrizzle = yield* PgDrizzle.PgDrizzle;

      return {
        findAll: () =>
          Effect.tryPromise({
            try: () =>
              pgdrizzle
                .select({
                  id: customers.id,
                  name: customers.name,
                })
                .from(customers)
                .orderBy(customers.name),
            catch: (e) =>
              new CustomerServiceError({
                message: `findAll failed: ${e}`,
              }),
          }),

        fetchFiltered: (query: string) =>
          Effect.tryPromise({
            try: async () => {
              const searchPattern = `%${query}%`;

              const result = await pgdrizzle
                .select({
                  id: customers.id,
                  name: customers.name,
                  email: customers.email,
                  imageUrl: customers.imageUrl,
                  totalInvoices: sql<number>`count(${invoices.id})`.as(
                    "total_invoices"
                  ),
                  totalPending:
                    sql<number>`sum(case when ${invoices.status} = 'pending' then ${invoices.amount} else 0 end)`.as(
                      "total_pending"
                    ),
                  totalPaid:
                    sql<number>`sum(case when ${invoices.status} = 'paid' then ${invoices.amount} else 0 end)`.as(
                      "total_paid"
                    ),
                })
                .from(customers)
                .leftJoin(invoices, eq(customers.id, invoices.customerId))
                .where(
                  or(
                    ilike(customers.name, searchPattern),
                    ilike(customers.email, searchPattern)
                  )
                )
                .groupBy(
                  customers.id,
                  customers.name,
                  customers.email,
                  customers.imageUrl
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
          }),
      } as const;
    }),
  }
) {}
