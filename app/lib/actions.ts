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
  runService,
  UserService,
} from "@/app/services";
import {
  AUTH_ERROR_MESSAGES,
  AUTH_SUCCESS_MESSAGES,
  AuthErrorCode,
  AuthSuccessCode,
} from "@/lib/auth/messages/auth-messages";
import { setFlash } from "@/lib/flash-toaster";
import { deleteUserSchema } from "../setting/profile/schema";
import { fetchCurrentUser } from "./data";
import { buildAbsoluteCallbackURL } from "./url-helpers";

export async function signOut() {
  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* AuthService;
      yield* service.signOut();
    }),
  );

  if (Either.isLeft(result)) {
    await setFlash({
      type: "error",
      message: AUTH_ERROR_MESSAGES[AuthErrorCode.SIGNOUT_FAILED],
    });
    redirect("/");
  }

  await setFlash({
    type: "success",
    message: AUTH_SUCCESS_MESSAGES[AuthSuccessCode.LOGGED_OUT],
  });
  redirect("/");
}

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

  const result = await runService(() =>
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
  formData: FormData,
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
    }),
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
          message: `Failed to delete invoice: ${result.left._tag}`,
        });
    }
    revalidatePath("/dashboard/invoices");
    return;
  }

  await setFlash({ type: "success", message: "Invoice deleted successfully." });
  revalidatePath("/dashboard/invoices");
}

export async function deleteUser(_prevState: unknown, formData: FormData) {
  formData.set("id", (await fetchCurrentUser()).id);

  const submission = parseWithZod(formData, { schema: deleteUserSchema });

  if (submission.status !== "success") {
    return submission.reply({
      formErrors: ["user id is not defined."],
    });
  }

  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* UserService;
      return yield* service.delete(submission.value.id);
    }),
  );

  if (Either.isLeft(result)) {
    switch (result.left._tag) {
      case "UserNotFound":
        return submission.reply({
          formErrors: ["User not found."],
        });
      default:
        return submission.reply({
          formErrors: [`Failed to delete user: ${result.left._tag}`],
        });
    }
  }

  await setFlash({ type: "success", message: "user deleted." });
  await signOut();
  return submission.reply();
}
