import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string;
}

export async function fetchCurrentUser(): Promise<CurrentUser> {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const { id, name, email, image } = session?.user ?? {};
  return {
    id: id ?? "",
    name: name ?? "",
    email: email ?? "",
    image: image ?? "",
  };
}
