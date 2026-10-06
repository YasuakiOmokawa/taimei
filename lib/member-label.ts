import type { Member } from "@taimei-code/auth-client";

export const memberLabel = ({ name, email }: Pick<Member, "name" | "email">) =>
  name.trim() || email;
