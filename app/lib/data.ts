import { Effect, Result } from "effect";
import {
  type CardData,
  CustomerService,
  DashboardService,
  InvoiceService,
  type LatestInvoice,
  type Revenue,
  runScopedService,
} from "@/app/services";
import { getSession } from "./auth-guard";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string;
}

export type { CardData, LatestInvoice, Revenue };

// cache() 付き getSession() から導出（二重 RPC 回避）
export async function fetchCurrentUser(): Promise<CurrentUser> {
  const session = await getSession();

  const { id, name, email, image } = session?.user ?? {};
  return {
    id: id ?? "",
    name: name ?? "",
    email: email ?? "",
    image: image ?? "",
  };
}

export async function fetchRevenue(): Promise<Revenue[]> {
  const result = await runScopedService(() =>
    Effect.gen(function* () {
      const service = yield* DashboardService;
      return yield* service.fetchRevenue();
    }),
  );

  if (Result.isFailure(result)) {
    console.error("Database Error:", result.failure);
    throw new Error("Failed to fetch revenue data.");
  }

  return result.success;
}

export async function fetchLatestInvoices(): Promise<LatestInvoice[]> {
  const result = await runScopedService(() =>
    Effect.gen(function* () {
      const service = yield* DashboardService;
      return yield* service.fetchLatestInvoices();
    }),
  );

  if (Result.isFailure(result)) {
    console.error("Database Error:", result.failure);
    throw new Error("Failed to fetch the latest invoices.");
  }

  return result.success;
}

export async function fetchCardData(): Promise<CardData> {
  const result = await runScopedService(() =>
    Effect.gen(function* () {
      const service = yield* DashboardService;
      return yield* service.fetchCardData();
    }),
  );

  if (Result.isFailure(result)) {
    console.error("Database Error:", result.failure);
    throw new Error("Failed to fetch card data.");
  }

  return result.success;
}

export type InvoiceSelectionById = {
  id: string;
  customerId: string;
  amount: number;
  status: "pending" | "paid";
};

export type CustomerField = {
  id: string;
  name: string;
};

export type FilteredInvoice = {
  id: string;
  amount: number;
  date: string;
  status: "pending" | "paid";
  name: string;
  email: string;
  imageUrl: string;
};

export type FilteredCustomer = {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  totalInvoices: number;
  totalPending: string;
  totalPaid: string;
};

const formatCurrency = (amount: number) => {
  return (amount / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
};

export async function fetchFilteredInvoices(
  query: string,
  currentPage: number,
): Promise<FilteredInvoice[]> {
  const result = await runScopedService(() =>
    Effect.gen(function* () {
      const service = yield* InvoiceService;
      return yield* service.fetchFiltered(query, currentPage);
    }),
  );

  if (Result.isFailure(result)) {
    console.error("Database Error:", result.failure);
    throw new Error("Failed to fetch filtered invoices.");
  }

  return result.success.map((invoice) => ({
    id: invoice.id,
    amount: invoice.amount,
    date: invoice.date,
    status: invoice.status as "pending" | "paid",
    name: invoice.name,
    email: invoice.email,
    imageUrl: invoice.imageUrl,
  }));
}

export async function fetchInvoicesPages(query: string): Promise<number> {
  const result = await runScopedService(() =>
    Effect.gen(function* () {
      const service = yield* InvoiceService;
      return yield* service.fetchPages(query);
    }),
  );

  if (Result.isFailure(result)) {
    console.error("Database Error:", result.failure);
    throw new Error("Failed to fetch invoice pages.");
  }

  return result.success;
}

export async function fetchInvoiceById(
  id: string,
): Promise<InvoiceSelectionById | null> {
  const result = await runScopedService(() =>
    Effect.gen(function* () {
      const service = yield* InvoiceService;
      return yield* service.findById(id);
    }),
  );

  if (Result.isFailure(result)) {
    if (result.failure._tag === "InvoiceNotFound") {
      return null;
    }
    console.error("Database Error:", result.failure);
    throw new Error("Failed to fetch invoice.");
  }

  return {
    id: result.success.id,
    customerId: result.success.customerId,
    amount: result.success.amount / 100,
    status: result.success.status as "pending" | "paid",
  };
}

export async function fetchCustomers(): Promise<CustomerField[]> {
  const result = await runScopedService(() =>
    Effect.gen(function* () {
      const service = yield* CustomerService;
      return yield* service.findAll();
    }),
  );

  if (Result.isFailure(result)) {
    console.error("Database Error:", result.failure);
    throw new Error("Failed to fetch customers.");
  }

  return result.success;
}

export async function fetchFilteredCustomers(
  query: string,
): Promise<FilteredCustomer[]> {
  const result = await runScopedService(() =>
    Effect.gen(function* () {
      const service = yield* CustomerService;
      return yield* service.fetchFiltered(query);
    }),
  );

  if (Result.isFailure(result)) {
    console.error("Database Error:", result.failure);
    throw new Error("Failed to fetch filtered customers.");
  }

  return result.success.map((customer) => ({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    imageUrl: customer.imageUrl,
    totalInvoices: customer.totalInvoices,
    totalPending: formatCurrency(customer.totalPending),
    totalPaid: formatCurrency(customer.totalPaid),
  }));
}
