import { setFlash } from "../flash-toaster";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/prisma";

const adapter = PrismaAdapter(prisma);

type Props =
  | {
      type: "oauth";
      authType: string;
    }
  | { type: "email"; email: string };

export async function setAuthResponseMessage(props: Props): Promise<void> {
  if (await isSigninRequest(props)) {
    await setFlash({
      type: "success",
      message: "ログインしました。",
    });
  }
  if (await isSignupRequest(props)) {
    await setFlash({
      type: "success",
      message: "アカウントを登録しました。",
    });
  }
}

async function isSigninRequest(props: Props): Promise<boolean> {
  if (props.type === "oauth") {
    return props.authType === "signin";
  } else if (props.type === "email") {
    return !!(await adapter.getUserByEmail?.(props.email));
  } else {
    return false;
  }
}

async function isSignupRequest(props: Props): Promise<boolean> {
  if (props.type === "oauth") {
    return props.authType === "signup";
  } else if (props.type === "email") {
    return !(await adapter.getUserByEmail?.(props.email));
  } else {
    return false;
  }
}
