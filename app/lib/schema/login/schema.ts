import { z } from "zod/v4";

export const emailLinkLoginSchema = z.object({
  email: z.email(),
});
