"use client";

import { authClient } from "@/lib/auth-client";
import { CurrentUser } from "@/app/lib/data";

export function useCurrentUser(): CurrentUser {
  const { data: session } = authClient.useSession();
  const { id, name, email, image } = session?.user ?? {};
  return {
    id: id ?? "",
    name: name ?? "",
    email: email ?? "",
    image: image ?? "",
  };
}
