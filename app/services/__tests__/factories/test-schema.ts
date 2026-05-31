import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import * as appSchema from "@/db/drizzle/schema";

// user テーブルは auth-service DB に移動済みだが、テストでは taimei DB に
// 残存する user テーブルに直接書き込む（テスト用の暫定措置）
const user = pgTable(
  "user",
  {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("user_email_key").using(
      "btree",
      table.email.asc().nullsLast().op("text_ops"),
    ),
  ],
);

// test-db.ts からも参照するため export
export const testTableSchema = { user };

// composeFactory は全 factory が同一 Schema 型を共有する必要があるため、
// アプリスキーマ (customers/invoices/revenue 等) と test 用 user を統合した schema を使う。
export const factorySchema = { ...appSchema, user };
