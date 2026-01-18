import { Effect, Either } from "effect";
import { runService, CustomerService } from "@/app/services";

export type CustomerField = {
  id: string;
  name: string;
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

const formatCurrency = (amount: number) => {
  return (amount / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
};

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
    image_url: customer.imageUrl,
    total_invoices: customer.totalInvoices,
    total_pending: formatCurrency(customer.totalPending),
    total_paid: formatCurrency(customer.totalPaid),
  }));
}
