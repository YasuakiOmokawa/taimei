import { drizzle } from "drizzle-orm/node-postgres";
import * as authSchema from "./auth-schema";

// taimei-auth DB connection (e2e 環境では postgres://...:5435/auth)。
// signIn helper の getVerificationToken / createTestUser がここを参照する。
export const authDb = drizzle(process.env.AUTH_DATABASE_URL!, {
  schema: authSchema,
});
