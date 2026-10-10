import {
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey().notNull(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    // session の companyId source (ADR-009)。dashboard は company 必須 (ADR-0002) のため
    // e2e ユーザーにはここを set した上で sign-in する (verify 時に cookie へ焼き込まれる)。
    lastUsedCompanyId: text("last_used_company_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("user_email_key").using(
      "btree",
      table.email.asc().nullsLast().op("text_ops"),
    ),
  ],
);

export const company = pgTable("company", {
  id: text("id").primaryKey().notNull(),
  name: text("name").notNull(),
  orgCode: text("org_code").notNull(),
  activationStatus: text("activation_status").default("ACTIVE").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const membership = pgTable("membership", {
  id: text("id").primaryKey().notNull(),
  userId: text("user_id").notNull(),
  companyId: text("company_id").notNull(),
  role: text("role").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey().notNull(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);
