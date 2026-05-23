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

export const customers = pgTable("customers", {
  id: uuid().defaultRandom().primaryKey().notNull(),
  name: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull(),
  imageUrl: varchar("image_url", { length: 255 }).notNull(),
});

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
  },
  (table) => [
    foreignKey({
      columns: [table.customerId],
      foreignColumns: [customers.id],
      name: "invoices_customer_id_fkey",
    })
      .onUpdate("cascade")
      .onDelete("cascade"),
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
  },
  (table) => [
    uniqueIndex("revenue_month_key").using(
      "btree",
      table.month.asc().nullsLast().op("text_ops"),
    ),
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
