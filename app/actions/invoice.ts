"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseWithZod } from "@conform-to/zod/v4";
import { invoiceSchema } from "@/app/schema/invoice";
import { setFlash } from "@/lib/flash-toaster";
import { Effect, Either } from "effect";
import { runService, InvoiceService } from "@/app/services";

export async function createInvoice(_prevState: unknown, formData: FormData) {
  const submission = parseWithZod(formData, { schema: invoiceSchema });

  if (submission.status !== "success") {
    return submission.reply();
  }

  const { amount, status, customerId } = submission.value;
  const amountInCents = Math.round(amount * 100);

  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* InvoiceService;
      return yield* service.create({
        customerId,
        amount: amountInCents,
        status,
      });
    })
  );

  if (Either.isLeft(result)) {
    return submission.reply({
      formErrors: [`請求書の作成に失敗しました: ${result.left._tag}`],
    });
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function updateInvoice(
  id: string,
  _prevState: unknown,
  formData: FormData
) {
  const submission = parseWithZod(formData, { schema: invoiceSchema });

  if (submission.status !== "success") {
    return submission.reply();
  }

  const { amount, status, customerId } = submission.value;
  const amountInCents = Math.round(amount * 100);

  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* InvoiceService;
      return yield* service.update({
        id,
        customerId,
        amount: amountInCents,
        status,
      });
    })
  );

  if (Either.isLeft(result)) {
    switch (result.left._tag) {
      case "InvoiceNotFound":
        return submission.reply({
          formErrors: ["請求書が見つかりません"],
        });
      default:
        return submission.reply({
          formErrors: [`請求書の更新に失敗しました: ${result.left._tag}`],
        });
    }
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function deleteInvoice(id: string, _prevState: unknown) {
  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* InvoiceService;
      return yield* service.delete(id);
    })
  );

  if (Either.isLeft(result)) {
    switch (result.left._tag) {
      case "InvoiceNotFound":
        await setFlash({ type: "error", message: "Invoice not found." });
        break;
      default:
        await setFlash({
          type: "error",
          message: `Failed to delete invoice: ${result.left._tag}`,
        });
    }
    revalidatePath("/dashboard/invoices");
    return;
  }

  await setFlash({ type: "success", message: "Invoice deleted successfully." });
  revalidatePath("/dashboard/invoices");
}
