import { Effect } from "effect";
import { DashboardRepository } from "./dashboard-repository";
import { formatCurrency } from "@/app/lib/utils";

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
      const repository = yield* DashboardRepository;

      return {
        fetchRevenue: () => repository.fetchRevenue(),

        fetchLatestInvoices: () =>
          Effect.gen(function* () {
            const data = yield* repository.fetchLatestInvoices();
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
                repository.fetchInvoiceCount(),
                repository.fetchCustomerCount(),
                repository.fetchInvoiceStatus(),
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
