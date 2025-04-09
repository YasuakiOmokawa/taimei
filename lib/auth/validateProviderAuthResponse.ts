import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/prisma";
import { setFlash } from "../flash-toaster";

const adapter = PrismaAdapter(prisma);

type Props = {
  authType: string;
  profileEmail: string;
  providerAccountId: string;
  provider: string;
};

export async function validateProviderAuthResponse(
  props: Props
): Promise<boolean | string> {
  if (await userExistsWithoutLinkedAccount(props)) {
    await setFlash({
      type: "error",
      message: `Email: ${props.profileEmail} のアカウントが存在します。ログインして連携してください。`,
    });
    return "/login";
  }
  if (await isSigninWithoutLinkedAccount(props)) {
    await setFlash({
      type: "error",
      message: "アカウントが存在しません。",
    });
    return "/login";
  }
  if (await isSignupWithExistingLinkedAccount(props)) {
    await setFlash({
      type: "error",
      message: "アカウントがすでに存在します。ログインしてください。",
    });
    return "/login";
  } else {
    return true;
  }
}

function isSigninRequest({ authType }: Props): boolean {
  return authType === "signin";
}

function isSignupRequest({ authType }: Props): boolean {
  return authType === "signup";
}

async function userExistsWithoutLinkedAccount(props: Props): Promise<boolean> {
  const { authType, profileEmail } = props;
  return (
    ["signin", "signup"].includes(authType) &&
    !!(await adapter.getUserByEmail?.(profileEmail)) &&
    !(await hasLinkedAccount(props))
  );
}

async function isSigninWithoutLinkedAccount(props: Props): Promise<boolean> {
  return isSigninRequest(props) && !(await hasLinkedAccount(props));
}

async function isSignupWithExistingLinkedAccount(
  props: Props
): Promise<boolean> {
  return isSignupRequest(props) && (await hasLinkedAccount(props));
}

async function hasLinkedAccount({
  providerAccountId,
  provider,
}: Props): Promise<boolean> {
  return !!(await adapter.getUserByAccount?.({
    providerAccountId: providerAccountId,
    provider: provider,
  }));
}
