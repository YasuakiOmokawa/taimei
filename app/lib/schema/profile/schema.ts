import { z } from "zod";

export const userSchema = z.object({
  name: z.string(),
  bio: z.string(),
});

export const deleteUserSchema = z.object({
  id: z.string(),
});
