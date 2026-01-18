import { Effect, Either } from "effect";
import { runService, InvoiceService } from "@/app/services";

export type InvoiceSelectionById = {
  id: string;
  customer_id: string;
  amount: number;
  status: "pending" | "paid";
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
    image_url: invoice.imageUrl,
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
