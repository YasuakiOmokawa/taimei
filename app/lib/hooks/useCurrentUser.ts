"use client";

import { useSession } from "next-auth/react";
import { CurrentUser } from "../data";

export function useCurrentUser(): CurrentUser {
  const { data: session } = useSession();
  const { id, name, email, image } = session?.user ?? {};
  return {
    id: id ?? "",
    name: name ?? "",
    email: email ?? "",
    image: image ?? "",
  };
}
