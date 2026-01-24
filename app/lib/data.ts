import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Effect, Either } from "effect";
import {
  runService,
  DashboardService,
  UserProfileService,
  InvoiceService,
  CustomerService,
  type Revenue,
  type LatestInvoice,
  type CardData,
} from "@/app/services";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string;
}

export type { Revenue, LatestInvoice, CardData };

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const { id, name, email, image } = session?.user ?? {};
  return {
    id: id ?? "",
    name: name ?? "",
    email: email ?? "",
    image: image ?? "",
  };
}

export async function fetchRevenue(): Promise<Revenue[]> {
  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* DashboardService;
      return yield* service.fetchRevenue();
    })
  );

  if (Either.isLeft(result)) {
    console.error("Database Error:", result.left);
    throw new Error("Failed to fetch revenue data.");
  }

  return result.right;
}

export async function fetchLatestInvoices(): Promise<LatestInvoice[]> {
  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* DashboardService;
      return yield* service.fetchLatestInvoices();
    })
  );

  if (Either.isLeft(result)) {
    console.error("Database Error:", result.left);
    throw new Error("Failed to fetch the latest invoices.");
  }

  return result.right;
}

export type UserProfileSelectionById = {
  bio: string;
};

export async function fetchUserProfile(
  userId: string
): Promise<UserProfileSelectionById | null> {
  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* UserProfileService;
      return yield* service.findByUserId(userId);
    })
  );

  if (Either.isLeft(result)) {
    if (result.left._tag === "UserProfileNotFound") {
      return null;
    }
    throw new Error("failed to fetch UserProfile.", { cause: result.left });
  }

  return { bio: result.right.bio };
}

export async function fetchCardData(): Promise<CardData> {
  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* DashboardService;
      return yield* service.fetchCardData();
    })
  );

  if (Either.isLeft(result)) {
    console.error("Database Error:", result.left);
    throw new Error("Failed to fetch card data.");
  }

  return result.right;
}

export type InvoiceSelectionById = {
  id: string;
  customer_id: string;
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
  total_invoices: number;
  total_pending: string;
  total_paid: string;
};

const formatCurrency = (amount: number) => {
  return (amount / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
};

export async function fetchFilteredInvoices(
  query: string,
  currentPage: number
): Promise<FilteredInvoice[]> {
  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* InvoiceService;
      return yield* service.fetchFiltered(query, currentPage);
    })
  );

  if (Either.isLeft(result)) {
    console.error("Database Error:", result.left);
    throw new Error("Failed to fetch filtered invoices.");
  }

  return result.right.map((invoice) => ({
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
  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* InvoiceService;
      return yield* service.fetchPages(query);
    })
  );

  if (Either.isLeft(result)) {
    console.error("Database Error:", result.left);
    throw new Error("Failed to fetch invoice pages.");
  }

  return result.right;
}

export async function fetchInvoiceById(
  id: string
): Promise<InvoiceSelectionById | null> {
  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* InvoiceService;
      return yield* service.findById(id);
    })
  );

  if (Either.isLeft(result)) {
    if (result.left._tag === "InvoiceNotFound") {
      return null;
    }
    console.error("Database Error:", result.left);
    throw new Error("Failed to fetch invoice.");
  }

  return {
    id: result.right.id,
    customer_id: result.right.customerId,
    amount: result.right.amount / 100,
    status: result.right.status as "pending" | "paid",
  };
}

export async function fetchCustomers(): Promise<CustomerField[]> {
  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* CustomerService;
      return yield* service.findAll();
    })
  );

  if (Either.isLeft(result)) {
    console.error("Database Error:", result.left);
    throw new Error("Failed to fetch customers.");
  }

  return result.right;
}

export async function fetchFilteredCustomers(
  query: string
): Promise<FilteredCustomer[]> {
  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* CustomerService;
      return yield* service.fetchFiltered(query);
    })
  );

  if (Either.isLeft(result)) {
    console.error("Database Error:", result.left);
    throw new Error("Failed to fetch filtered customers.");
  }

  return result.right.map((customer) => ({
    id: customer.id,
    name: customer.name,
    email: customer.email,
    imageUrl: customer.imageUrl,
    total_invoices: customer.totalInvoices,
    total_pending: formatCurrency(customer.totalPending),
    total_paid: formatCurrency(customer.totalPaid),
  }));
}
