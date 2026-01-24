import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { Effect } from "effect";
import { invoices, customers } from "@/db/drizzle/schema";
import { eq, or, ilike, sql, desc, count } from "drizzle-orm";
import { InvoiceNotFound, InvoiceServiceError } from "./invoice-errors";

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

export class InvoiceService extends Effect.Service<InvoiceService>()(
  "services/InvoiceService",
  {
    effect: Effect.gen(function* () {
      const pgdrizzle = yield* PgDrizzle.PgDrizzle;

      return {
        create: (input: CreateInvoiceInput) =>
          Effect.tryPromise({
            try: () =>
              pgdrizzle
                .insert(invoices)
                .values({
                  customerId: input.customerId,
                  amount: input.amount,
                  status: input.status,
                })
                .returning()
                .then((res) => res[0]),
            catch: (e) =>
              new InvoiceServiceError({
                message: `create failed: ${e}`,
              }),
          }),

        update: (input: UpdateInvoiceInput) =>
          Effect.gen(function* () {
            const result = yield* Effect.tryPromise({
              try: () =>
                pgdrizzle
                  .update(invoices)
                  .set({
                    customerId: input.customerId,
                    amount: input.amount,
                    status: input.status,
                  })
                  .where(eq(invoices.id, input.id))
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
            const existing = yield* Effect.tryPromise({
              try: () =>
                pgdrizzle
                  .select({ id: invoices.id })
                  .from(invoices)
                  .where(eq(invoices.id, id))
                  .then((res) => res.at(0)),
              catch: (e) =>
                new InvoiceServiceError({
                  message: `delete findById failed: ${e}`,
                }),
            });
            if (!existing) {
              return yield* new InvoiceNotFound({ id });
            }
            yield* Effect.tryPromise({
              try: () =>
                pgdrizzle
                  .delete(invoices)
                  .where(eq(invoices.id, id))
                  .returning(),
              catch: (e) =>
                new InvoiceServiceError({
                  message: `delete failed: ${e}`,
                }),
            });
          }),

        findById: (id: string) =>
          Effect.gen(function* () {
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
                  .where(eq(invoices.id, id))
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
          Effect.tryPromise({
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
                  or(
                    ilike(customers.name, searchPattern),
                    ilike(customers.email, searchPattern),
                    ilike(invoices.status, searchPattern),
                    sql`${invoices.amount}::text ILIKE ${searchPattern}`,
                    sql`${invoices.date}::text ILIKE ${searchPattern}`
                  )
                )
                .orderBy(desc(invoices.date))
                .limit(itemsPerPage)
                .offset(offset);
            },
            catch: (e) =>
              new InvoiceServiceError({
                message: `fetchFiltered failed: ${e}`,
              }),
          }),

        fetchPages: (query: string, itemsPerPage = 6) =>
          Effect.tryPromise({
            try: async () => {
              const searchPattern = `%${query}%`;

              const result = await pgdrizzle
                .select({ count: count() })
                .from(invoices)
                .innerJoin(customers, eq(invoices.customerId, customers.id))
                .where(
                  or(
                    ilike(customers.name, searchPattern),
                    ilike(customers.email, searchPattern),
                    ilike(invoices.status, searchPattern),
                    sql`${invoices.amount}::text ILIKE ${searchPattern}`,
                    sql`${invoices.date}::text ILIKE ${searchPattern}`
                  )
                );

              return Math.ceil(Number(result[0].count) / itemsPerPage);
            },
            catch: (e) =>
              new InvoiceServiceError({
                message: `fetchPages failed: ${e}`,
              }),
          }),
      } as const;
    }),
  }
) {}
