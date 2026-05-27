import { sql } from "drizzle-orm";
import {
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const customers = pgTable(
  "customers",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    name: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 255 }).notNull(),
    imageUrl: varchar("image_url", { length: 255 }).notNull(),
    // company_id は auth (taimei-auth) の company.id (cmp_<nanoid24>) への論理参照。
    // cross-DB のため FK は張らない。nullable で追加し NOT NULL 化は別 migration (expand-contract)。
    // 設計詳細: docs/adr/0002-company-data-scoping.md (D9)
    companyId: varchar("company_id", { length: 32 }),
  },
  (table) => [index("customers_company_id_idx").on(table.companyId)],
);

export const tags2 = pgTable("tags2", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: varchar({ length: 255 }).notNull(),
  createdAt: timestamp("created_at", { precision: 6, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updated_at", { precision: 6, mode: "date" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const tags = pgTable("tags", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: varchar({ length: 255 }).notNull(),
});

export const invoices = pgTable(
  "invoices",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    amount: integer().notNull(),
    status: varchar({ length: 255 }).notNull(),
    date: date().default(sql`CURRENT_TIMESTAMP`).notNull(),
    customerId: uuid("customer_id").notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    // auth company.id への論理参照 (FK なし)。詳細は customers.companyId と docs/adr/0002 を参照。
    companyId: varchar("company_id", { length: 32 }),
  },
  (table) => [
    foreignKey({
      columns: [table.customerId],
      foreignColumns: [customers.id],
      name: "invoices_customer_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    index("invoices_company_id_idx").on(table.companyId),
  ],
);

export const revenue = pgTable(
  "revenue",
  {
    month: varchar({ length: 4 }).notNull(),
    revenue: integer().notNull(),
    createdAt: timestamp("created_at", { precision: 6, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { precision: 6, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    // auth company.id への論理参照 (FK なし)。詳細は customers.companyId と docs/adr/0002 を参照。
    // month 単独 unique は別 migration で (company_id, month) に変更する (社ごと同月行を許可)。
    companyId: varchar("company_id", { length: 32 }),
  },
  (table) => [
    uniqueIndex("revenue_month_key").using(
      "btree",
      table.month.asc().nullsLast().op("text_ops"),
    ),
    index("revenue_company_id_idx").on(table.companyId),
  ],
);

export const invoicesTotags = pgTable(
  "_invoicesTotags",
  {
    a: uuid("A").notNull(),
    b: uuid("B").notNull(),
  },
  (table) => [
    index().using("btree", table.b.asc().nullsLast().op("uuid_ops")),
    foreignKey({
      columns: [table.a],
      foreignColumns: [invoices.id],
      name: "_invoicesTotags_A_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    foreignKey({
      columns: [table.b],
      foreignColumns: [tags.id],
      name: "_invoicesTotags_B_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
    primaryKey({
      columns: [table.a, table.b],
      name: "_invoicesTotags_AB_pkey",
    }),
  ],
);
