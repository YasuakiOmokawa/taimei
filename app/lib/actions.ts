"use server";

import { parseWithZod } from "@conform-to/zod/v4";
import { Effect, Either } from "effect";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Email } from "@/app/domain/email";
import { invoiceSchema } from "@/app/schema/invoice";
import { emailLinkLoginSchema } from "@/app/schema/login";
import {
  AuthService,
  InvoiceService,
  runScopedService,
  runService,
} from "@/app/services";
import {
  AUTH_ERROR_MESSAGES,
  AUTH_SUCCESS_MESSAGES,
  AuthErrorCode,
  AuthSuccessCode,
} from "@/lib/auth/messages/auth-messages";
import { setFlash } from "@/lib/flash-toaster";
import { buildAbsoluteCallbackURL } from "./url-helpers";

export async function sendAuthEmailLink(
  redirectPath: string,
  _prevState: unknown,
  formData: FormData,
) {
  const submission = parseWithZod(formData, {
    schema: emailLinkLoginSchema,
  });

  if (submission.status !== "success") {
    return submission.reply();
  }

  const callbackURL = await buildAbsoluteCallbackURL(redirectPath);

  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* AuthService;
      yield* service.sendMagicLink(
        Email.fromTrusted(submission.value.email),
        callbackURL,
      );
    }),
  );

  if (Either.isLeft(result)) {
    console.error("Magic link error:", result.left);
    return submission.reply({
      formErrors: [AUTH_ERROR_MESSAGES[AuthErrorCode.MAGIC_LINK_FAILED]],
    });
  }

  await setFlash({
    type: "success",
    message: AUTH_SUCCESS_MESSAGES[AuthSuccessCode.MAGIC_LINK_SENT],
  });
  return submission.reply();
}

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

  if (Either.isLeft(result)) {
    switch (result.left._tag) {
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

  if (Either.isLeft(result)) {
    switch (result.left._tag) {
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

  if (Either.isLeft(result)) {
    switch (result.left._tag) {
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
