import { getSession } from "./auth-guard";

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  image: string;
}

// cache() 付き getSession() から導出（二重 RPC 回避）
export async function fetchCurrentUser(): Promise<CurrentUser> {
  const session = await getSession();

  const { id, name, email, image } = session?.user ?? {};
  return {
    id: id ?? "",
    name: name ?? "",
    email: email ?? "",
    image: image ?? "",
  };
}
