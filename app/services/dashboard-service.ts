import { Effect, Layer } from "effect";
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

const makeDashboardService = Effect.gen(function* () {
  const repository = yield* DashboardRepository;

  const fetchRevenue = (): Effect.Effect<
    Revenue[],
    ReturnType<typeof repository.fetchRevenue> extends Effect.Effect<
      unknown,
      infer E,
      unknown
    >
      ? E
      : never
  > => repository.fetchRevenue();

  const fetchLatestInvoices = () =>
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
    });

  const fetchCardData = () =>
    Effect.gen(function* () {
      const [invoiceCount, customerCount, invoiceStatus] = yield* Effect.all([
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
    });

  return {
    fetchRevenue,
    fetchLatestInvoices,
    fetchCardData,
  };
});

export class DashboardService extends Effect.Tag("services/DashboardService")<
  DashboardService,
  Effect.Effect.Success<typeof makeDashboardService>
>() {
  static Live = Layer.effect(this, makeDashboardService);
}
