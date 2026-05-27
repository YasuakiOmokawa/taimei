import * as PgDrizzle from "@effect/sql-drizzle/Pg";
import { and, desc, eq, sql } from "drizzle-orm";
import { Effect } from "effect";
import { formatCurrency } from "@/app/lib/utils";
import { customers, invoices, revenue } from "@/db/drizzle/schema";
import { companyFilter } from "@/db/scoped";
import { CompanyContext } from "./company-context";
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
    imageUrl: string;
  };
};

export type CardData = {
  numberOfCustomers: number;
  numberOfInvoices: number;
  totalPaidInvoices: string;
  totalPendingInvoices: string;
};

// overview の全集計を CompanyContext の companyId で scope する。scope しないと
// 売上チャート・カード・最新請求書が全社横断で漏れる。設計詳細: docs/adr/0002-company-data-scoping.md。
export class DashboardService extends Effect.Service<DashboardService>()(
  "services/DashboardService",
  {
    effect: Effect.gen(function* () {
      const pgdrizzle = yield* PgDrizzle.PgDrizzle;

      const fetchRevenueData = (companyId: string) =>
        Effect.tryPromise({
          try: () =>
            pgdrizzle
              .select({
                month: revenue.month,
                revenue: revenue.revenue,
              })
              .from(revenue)
              .where(companyFilter(revenue, companyId)),
          catch: (e) =>
            new DashboardServiceError({
              message: `fetchRevenue failed: ${e}`,
            }),
        });

      const fetchLatestInvoicesData = (companyId: string) =>
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
              // join 先 customers にも companyFilter を AND する。invoices を scope しても、
              // stray な他社 customer を参照する行があると顧客名が漏れるため (innerJoin で除外)。
              .innerJoin(
                customers,
                and(
                  eq(invoices.customerId, customers.id),
                  companyFilter(customers, companyId),
                ),
              )
              .where(companyFilter(invoices, companyId))
              .orderBy(desc(invoices.date))
              .limit(5),
          catch: (e) =>
            new DashboardServiceError({
              message: `fetchLatestInvoices failed: ${e}`,
            }),
        });

      const fetchInvoiceCount = (companyId: string) =>
        Effect.tryPromise({
          try: async () => {
            const result = await pgdrizzle
              .select({ count: sql<number>`count(*)` })
              .from(invoices)
              .where(companyFilter(invoices, companyId));
            return Number(result[0].count);
          },
          catch: (e) =>
            new DashboardServiceError({
              message: `fetchInvoiceCount failed: ${e}`,
            }),
        });

      const fetchCustomerCount = (companyId: string) =>
        Effect.tryPromise({
          try: async () => {
            const result = await pgdrizzle
              .select({ count: sql<number>`count(*)` })
              .from(customers)
              .where(companyFilter(customers, companyId));
            return Number(result[0].count);
          },
          catch: (e) =>
            new DashboardServiceError({
              message: `fetchCustomerCount failed: ${e}`,
            }),
        });

      const fetchInvoiceStatus = (companyId: string) =>
        Effect.tryPromise({
          try: async () => {
            const result = await pgdrizzle
              .select({
                paid: sql<number>`SUM(CASE WHEN ${invoices.status} = 'paid' THEN ${invoices.amount} ELSE 0 END)`,
                pending: sql<number>`SUM(CASE WHEN ${invoices.status} = 'pending' THEN ${invoices.amount} ELSE 0 END)`,
              })
              .from(invoices)
              .where(companyFilter(invoices, companyId));
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
        fetchRevenue: () =>
          Effect.gen(function* () {
            const { companyId } = yield* CompanyContext;
            return yield* fetchRevenueData(companyId);
          }),

        fetchLatestInvoices: () =>
          Effect.gen(function* () {
            const { companyId } = yield* CompanyContext;
            const data = yield* fetchLatestInvoicesData(companyId);
            return data.map((invoice) => ({
              id: invoice.id,
              amount: formatCurrency(invoice.amount),
              customer: {
                name: invoice.customerName,
                email: invoice.customerEmail,
                imageUrl: invoice.customerImageUrl,
              },
            })) as LatestInvoice[];
          }),

        fetchCardData: () =>
          Effect.gen(function* () {
            const { companyId } = yield* CompanyContext;
            const [invoiceCount, customerCount, invoiceStatus] =
              yield* Effect.all([
                fetchInvoiceCount(companyId),
                fetchCustomerCount(companyId),
                fetchInvoiceStatus(companyId),
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
  },
) {}
