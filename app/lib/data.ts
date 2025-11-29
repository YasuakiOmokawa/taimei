import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Effect, Either } from "effect";
import {
  runService,
  DashboardService,
  UserProfileService,
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

// TODO: Effect-TS + Drizzle に移行予定
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
  image_url: string;
};

export type FilteredCustomer = {
  id: string;
  name: string;
  email: string;
  image_url: string;
  total_invoices: number;
  total_pending: string;
  total_paid: string;
};

export async function fetchFilteredInvoices(
  _query: string,
  _currentPage: number
): Promise<FilteredInvoice[]> {
  console.warn("fetchFilteredInvoices: Not implemented yet");
  return [];
}

export async function fetchInvoicesPages(_query: string): Promise<number> {
  console.warn("fetchInvoicesPages: Not implemented yet");
  return 0;
}

export async function fetchInvoiceById(
  _id: string
): Promise<InvoiceSelectionById | null> {
  console.warn("fetchInvoiceById: Not implemented yet");
  return null;
}

export async function fetchCustomers(): Promise<CustomerField[]> {
  console.warn("fetchCustomers: Not implemented yet");
  return [];
}

export async function fetchFilteredCustomers(
  _query: string
): Promise<FilteredCustomer[]> {
  console.warn("fetchFilteredCustomers: Not implemented yet");
  return [];
}
