"use server";

import { redirect } from "next/navigation";
import { parseWithZod } from "@conform-to/zod/v4";
import { emailLinkLoginSchema } from "@/app/lib/schema/login/schema";
import { setFlash } from "@/lib/flash-toaster";
import { Effect, Either } from "effect";
import { runService, AuthService } from "@/app/services";
import { Email } from "@/app/domain/email";
import {
  AuthErrorCode,
  AuthSuccessCode,
  AUTH_ERROR_MESSAGES,
  AUTH_SUCCESS_MESSAGES,
} from "@/lib/auth/messages/auth-messages";

export async function signOut() {
  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* AuthService;
      yield* service.signOut();
    })
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
  formData: FormData
) {
  const submission = parseWithZod(formData, {
    schema: emailLinkLoginSchema,
  });

  if (submission.status !== "success") {
    return submission.reply();
  }

  const result = await runService(() =>
    Effect.gen(function* () {
      const service = yield* AuthService;
      yield* service.sendMagicLink(
        Email.fromTrusted(submission.value.email),
        redirectPath
      );
    })
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
