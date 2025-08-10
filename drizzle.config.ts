import "dotenv/config";
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle",
  dialect: "postgresql",
  schema: "./db/drizzle/schema.ts",
  dbCredentials: {
    url: process.env.PGDATABASE_URL!,
  },
});
