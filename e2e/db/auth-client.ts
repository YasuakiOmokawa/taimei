import { drizzle } from "drizzle-orm/node-postgres";
import * as authSchema from "./auth-schema";

export const authDb = drizzle(process.env.AUTH_DATABASE_URL!, {
  schema: authSchema,
});
