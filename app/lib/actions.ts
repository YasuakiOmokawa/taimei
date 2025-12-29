"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validatesCreateInvoice, validatesUpdateInvoice } from "./validates";
import { parseWithZod } from "@conform-to/zod/v4";
import { emailLinkLoginSchema } from "./schema/login/schema";
import { setFlash } from "@/lib/flash-toaster";
import { deleteUserSchema } from "../setting/profile/schema";
import { fetchCurrentUser } from "./data";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Effect, Either } from "effect";
import { runService, UserService, InvoiceService } from "@/app/services";

// for create/update
export type State = {
  errors?: {
    customerId?: string[];
    amount?: string[];
    status?: string[];
  };
  message?: string | null;
  formData?: {
    customerId?: string;
    amount?: number;
    status?: string;
  };
};

export async function signOut() {
  await setFlash({
    type: "success",
    message: "ログアウトしました。",
  });
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}

// GitHub ログインはクライアントサイドで実行（Phase 7 で実装）
// Server Action から直接 OAuth を開始できないため、authClient.signIn.social を使用

// Effect-TS サービス経由でユーザー存在チェック
async function isExistsUser(email: string): Promise<boolean> {
  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* UserService;
      return yield* service.existsByEmail(email);
    })
  );

  if (Either.isLeft(result)) {
    throw new Error(`Failed to check user existence: ${result.left._tag}`);
  }

  return result.right;
}

export async function loginWithEmailLink(
  redirectPath: string,
  _prevState: unknown,
  formData: FormData
) {
  const submission = parseWithZod(formData, {
    schema: emailLinkLoginSchema,
  });

  if (submission.status !== "success") {
    return submission.reply();
  }

  // ログイン時：ユーザーが存在しない場合はエラー
  if (!(await isExistsUser(submission.value.email))) {
    await setFlash({
      type: "error",
      message: "アカウントが存在しません。",
    });
    return submission.reply();
  }

  // Better Auth の Magic Link API（サーバーサイド）を使用
  try {
    await auth.api.signInMagicLink({
      body: {
        email: submission.value.email,
        callbackURL: redirectPath,
      },
      headers: await headers(),
    });
  } catch (error) {
    console.error("Magic link error:", error);
    return submission.reply({
      formErrors: ["メール送信に失敗しました。"],
    });
  }

  await setFlash({
    type: "success",
    message: "メールを送信しました。",
  });
  return submission.reply();
}

export async function signupWithEmailLink(
  redirectPath: string,
  _prevState: unknown,
  formData: FormData
) {
  const submission = parseWithZod(formData, {
    schema: emailLinkLoginSchema,
  });

  if (submission.status !== "success") {
    return submission.reply();
  }

  // サインアップ時：ユーザーが既に存在する場合はエラー
  if (await isExistsUser(submission.value.email)) {
    await setFlash({
      type: "error",
      message: "アカウントがすでに存在します。",
    });
    return submission.reply();
  }

  // Better Auth の Magic Link API（サーバーサイド）を使用
  try {
    await auth.api.signInMagicLink({
      body: {
        email: submission.value.email,
        callbackURL: redirectPath,
      },
      headers: await headers(),
    });
  } catch (error) {
    console.error("Magic link error:", error);
    return submission.reply({
      formErrors: ["メール送信に失敗しました。"],
    });
  }

  await setFlash({
    type: "success",
    message: "メールを送信しました。",
  });
  return submission.reply();
}

export async function createInvoice(_prevState: State, formData: FormData) {
  const rawFormData = Object.fromEntries(formData.entries());
  const validatedFields = validatesCreateInvoice(rawFormData);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Invalid. Failed to Create Invoice.",
      formData: {
        customerId: rawFormData?.customerId
          ? String(rawFormData.customerId)
          : undefined,
        amount: rawFormData?.amount ? Number(rawFormData.amount) : undefined,
        status: rawFormData?.status ? String(rawFormData.status) : undefined,
      },
    };
  }

  const { amount, status, customerId } = validatedFields.data;
  const amountInCents = amount * 100;

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
    return {
      message: `Failed to create invoice: ${result.left._tag}`,
      formData: {
        customerId,
        amount,
        status,
      },
    };
  }

  revalidatePath("/dashboard/invoices");
  redirect("/dashboard/invoices");
}

export async function updateInvoice(
  id: string,
  _prevState: State,
  formData: FormData
) {
  const rawFormData = Object.fromEntries(formData.entries());
  const validatedFields = validatesUpdateInvoice(rawFormData);

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
      message: "Invalid. Failed to Update Invoice.",
      formData: {
        customerId: rawFormData?.customerId
          ? String(rawFormData.customerId)
          : undefined,
        amount: rawFormData?.amount ? Number(rawFormData.amount) : undefined,
        status: rawFormData?.status ? String(rawFormData.status) : undefined,
      },
    };
  }

  const { amount, status, customerId } = validatedFields.data;
  const amountInCents = amount * 100;

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
        return {
          message: "Invoice not found.",
          formData: { customerId, amount, status },
        };
      default:
        return {
          message: `Failed to update invoice: ${result.left._tag}`,
          formData: { customerId, amount, status },
        };
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
    })
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
