import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { Data, Effect, Layer } from "effect";
import { customers, invoices } from "@/db/drizzle/schema";
import { eq, or, ilike, sql } from "drizzle-orm";

const makeCustomerRepository = Effect.andThen(
  PgDrizzle.PgDrizzle,
  (pgdrizzle) => ({
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
          new CustomerRepositoryError({
            message: `Failed to fetch customers: ${e}`,
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
          new CustomerRepositoryError({
            message: `Failed to fetch filtered customers: ${e}`,
          }),
      }),
  })
);

export class CustomerRepository extends Effect.Tag(
  "services/CustomerRepository"
)<CustomerRepository, Effect.Effect.Success<typeof makeCustomerRepository>>() {
  static Live = Layer.effect(this, makeCustomerRepository);
}

export class CustomerRepositoryError extends Data.TaggedError(
  "CustomerRepositoryError"
)<{
  message: string;
}> {}
