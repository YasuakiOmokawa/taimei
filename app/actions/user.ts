"use server";

import { parseWithZod } from "@conform-to/zod/v4";
import { deleteUserSchema } from "@/app/setting/profile/schema";
import { setFlash } from "@/lib/flash-toaster";
import { fetchCurrentUser } from "@/app/lib/data";
import { Effect, Either } from "effect";
import { runService, UserService } from "@/app/services";
import { signOut } from "./auth";

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
