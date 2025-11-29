import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { Data, Effect, Layer } from "effect";
import { revenue, invoices, customers } from "@/db/drizzle/schema";
import { sql, desc, eq } from "drizzle-orm";

const makeDashboardRepository = Effect.andThen(
  PgDrizzle.PgDrizzle,
  (pgdrizzle) => ({
    fetchRevenue: () =>
      Effect.tryPromise({
        try: () =>
          pgdrizzle
            .select({
              month: revenue.month,
              revenue: revenue.revenue,
            })
            .from(revenue),
        catch: (e) =>
          new DashboardRepositoryError({
            message: `Failed to fetch revenue: ${e}`,
          }),
      }),

    fetchLatestInvoices: () =>
      Effect.tryPromise({
        try: () =>
          pgdrizzle
            .select({
              id: invoices.id,
              amount: invoices.amount,
              customerName: customers.name,
              customerEmail: customers.email,
              customerImageUrl: customers.imageUrl,
            })
            .from(invoices)
            .innerJoin(customers, eq(invoices.customerId, customers.id))
            .orderBy(desc(invoices.date))
            .limit(5),
        catch: (e) =>
          new DashboardRepositoryError({
            message: `Failed to fetch latest invoices: ${e}`,
          }),
      }),

    fetchInvoiceCount: () =>
      Effect.tryPromise({
        try: async () => {
          const result = await pgdrizzle
            .select({ count: sql<number>`count(*)` })
            .from(invoices);
          return Number(result[0].count);
        },
        catch: (e) =>
          new DashboardRepositoryError({
            message: `Failed to fetch invoice count: ${e}`,
          }),
      }),

    fetchCustomerCount: () =>
      Effect.tryPromise({
        try: async () => {
          const result = await pgdrizzle
            .select({ count: sql<number>`count(*)` })
            .from(customers);
          return Number(result[0].count);
        },
        catch: (e) =>
          new DashboardRepositoryError({
            message: `Failed to fetch customer count: ${e}`,
          }),
      }),

    fetchInvoiceStatus: () =>
      Effect.tryPromise({
        try: async () => {
          const result = await pgdrizzle
            .select({
              paid: sql<number>`SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END)`,
              pending: sql<number>`SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END)`,
            })
            .from(invoices);
          return {
            paid: Number(result[0].paid) || 0,
            pending: Number(result[0].pending) || 0,
          };
        },
        catch: (e) =>
          new DashboardRepositoryError({
            message: `Failed to fetch invoice status: ${e}`,
          }),
      }),
  })
);

export class DashboardRepository extends Effect.Tag(
  "services/DashboardRepository"
)<DashboardRepository, Effect.Effect.Success<typeof makeDashboardRepository>>() {
  static Live = Layer.effect(this, makeDashboardRepository);
}

export class DashboardRepositoryError extends Data.TaggedError(
  "DashboardRepositoryError"
)<{
  message: string;
}> {}
