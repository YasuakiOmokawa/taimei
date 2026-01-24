import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { Effect } from "effect";
import { revenue, invoices, customers } from "@/db/drizzle/schema";
import { sql, desc, eq } from "drizzle-orm";
import { formatCurrency } from "@/app/lib/utils";
import { DashboardServiceError } from "./dashboard-errors";

export type Revenue = {
  month: string;
  revenue: number;
};

export type LatestInvoice = {
  id: string;
  amount: string;
  customer: {
    name: string;
    email: string;
    image_url: string;
  };
};

export type CardData = {
  numberOfCustomers: number;
  numberOfInvoices: number;
  totalPaidInvoices: string;
  totalPendingInvoices: string;
};

export class DashboardService extends Effect.Service<DashboardService>()(
  "services/DashboardService",
  {
    effect: Effect.gen(function* () {
      const pgdrizzle = yield* PgDrizzle.PgDrizzle;

      const fetchRevenueData = () =>
        Effect.tryPromise({
          try: () =>
            pgdrizzle
              .select({
                month: revenue.month,
                revenue: revenue.revenue,
              })
              .from(revenue),
          catch: (e) =>
            new DashboardServiceError({
              message: `fetchRevenue failed: ${e}`,
            }),
        });

      const fetchLatestInvoicesData = () =>
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
            new DashboardServiceError({
              message: `fetchLatestInvoices failed: ${e}`,
            }),
        });

      const fetchInvoiceCount = () =>
        Effect.tryPromise({
          try: async () => {
            const result = await pgdrizzle
              .select({ count: sql<number>`count(*)` })
              .from(invoices);
            return Number(result[0].count);
          },
          catch: (e) =>
            new DashboardServiceError({
              message: `fetchInvoiceCount failed: ${e}`,
            }),
        });

      const fetchCustomerCount = () =>
        Effect.tryPromise({
          try: async () => {
            const result = await pgdrizzle
              .select({ count: sql<number>`count(*)` })
              .from(customers);
            return Number(result[0].count);
          },
          catch: (e) =>
            new DashboardServiceError({
              message: `fetchCustomerCount failed: ${e}`,
            }),
        });

      const fetchInvoiceStatus = () =>
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
            new DashboardServiceError({
              message: `fetchInvoiceStatus failed: ${e}`,
            }),
        });

      return {
        fetchRevenue: () => fetchRevenueData(),

        fetchLatestInvoices: () =>
          Effect.gen(function* () {
            const data = yield* fetchLatestInvoicesData();
            return data.map((invoice) => ({
              id: invoice.id,
              amount: formatCurrency(invoice.amount),
              customer: {
                name: invoice.customerName,
                email: invoice.customerEmail,
                image_url: invoice.customerImageUrl,
              },
            })) as LatestInvoice[];
          }),

        fetchCardData: () =>
          Effect.gen(function* () {
            const [invoiceCount, customerCount, invoiceStatus] =
              yield* Effect.all([
                fetchInvoiceCount(),
                fetchCustomerCount(),
                fetchInvoiceStatus(),
              ]);

            return {
              numberOfCustomers: customerCount,
              numberOfInvoices: invoiceCount,
              totalPaidInvoices: formatCurrency(invoiceStatus.paid),
              totalPendingInvoices: formatCurrency(invoiceStatus.pending),
            } as CardData;
          }),
      } as const;
    }),
  }
) {}
