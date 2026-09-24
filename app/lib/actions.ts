"use server";

import { parseWithZod } from "@conform-to/zod/v4";
import { Effect, Result } from "effect";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { invoiceSchema } from "@/app/schema/invoice";
import { InvoiceService, runScopedService } from "@/app/services";
import { setFlash } from "@/lib/flash-toaster";

export async function createInvoice(_prevState: unknown, formData: FormData) {
  const submission = parseWithZod(formData, { schema: invoiceSchema });

  if (submission.status !== "success") {
    return submission.reply();
  }

  const { amount, status, customerId } = submission.value;
  const amountInCents = Math.round(amount * 100);

  const result = await runScopedService(() =>
    Effect.gen(function* () {
      const service = yield* InvoiceService;
      return yield* service.create({
        customerId,
        amount: amountInCents,
        status,
      });
    }),
  );

  if (Result.isFailure(result)) {
    switch (result.failure._tag) {
      case "CustomerNotInScope":
        return submission.reply({
          fieldErrors: { customerId: ["指定した顧客が見つかりません"] },
        });
      default:
        return submission.reply({
          formErrors: ["請求書の作成に失敗しました"],
        });
    }
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function updateInvoice(
  id: string,
  _prevState: unknown,
  formData: FormData,
) {
  const submission = parseWithZod(formData, { schema: invoiceSchema });

  if (submission.status !== "success") {
    return submission.reply();
  }

  const { amount, status, customerId } = submission.value;
  const amountInCents = Math.round(amount * 100);

  const result = await runScopedService(() =>
    Effect.gen(function* () {
      const service = yield* InvoiceService;
      return yield* service.update({
        id,
        customerId,
        amount: amountInCents,
        status,
      });
    }),
  );

  if (Result.isFailure(result)) {
    switch (result.failure._tag) {
      case "InvoiceNotFound":
        return submission.reply({
          formErrors: ["請求書が見つかりません"],
        });
      case "CustomerNotInScope":
        return submission.reply({
          fieldErrors: { customerId: ["指定した顧客が見つかりません"] },
        });
      default:
        return submission.reply({
          formErrors: ["請求書の更新に失敗しました"],
        });
    }
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function deleteInvoice(id: string, _prevState: unknown) {
  const result = await runScopedService(() =>
    Effect.gen(function* () {
      const service = yield* InvoiceService;
      return yield* service.delete(id);
    }),
  );

  if (Result.isFailure(result)) {
    switch (result.failure._tag) {
      case "InvoiceNotFound":
        await setFlash({ type: "error", message: "Invoice not found." });
        break;
      default:
        await setFlash({
          type: "error",
          message: "Failed to delete invoice.",
        });
    }
    revalidatePath("/dashboard/invoices");
    return;
  }

  await setFlash({ type: "success", message: "Invoice deleted successfully." });
  revalidatePath("/dashboard/invoices");
}
