import { Effect, Either } from "effect";
import {
  runService,
  DashboardService,
  type Revenue,
  type LatestInvoice,
  type CardData,
} from "@/app/services";

export type { Revenue, LatestInvoice, CardData };

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
