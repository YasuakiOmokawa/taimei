import { composeFactory, defineFactory } from "@praha/drizzle-factory";
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
const factorySchema = { ...appSchema, user };

// company_id は sequence ユニークな default にする。設計意図: docs/adr/0002 のテスト戦略。
// 固定 default だと isolation テストで override 忘れ時に 2 社が同一 company になり誤 pass するが、
// sequence ユニークなら忘れても context の companyId と不一致 → 0 行 hit で loud に fail する。
const defaultCompanyId = (sequence: number) => `cmp_factory_${sequence}`;

export const userFactory = defineFactory({
  schema: factorySchema,
  table: "user",
  resolver: ({ sequence }) => ({
    id: `test-user-${sequence}`,
    name: `Test User ${sequence}`,
    email: `test${sequence}@example.com`,
    emailVerified: true,
    image: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  traits: {
    unverified: ({ sequence }) => ({
      id: `unverified-user-${sequence}`,
      name: `Unverified User ${sequence}`,
      email: `unverified${sequence}@example.com`,
      emailVerified: false,
      image: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  },
});

export const customerFactory = defineFactory({
  schema: factorySchema,
  table: "customers",
  resolver: ({ sequence }) => ({
    id: crypto.randomUUID(),
    name: `Customer ${sequence}`,
    email: `customer${sequence}@example.com`,
    imageUrl: `/customers/${sequence}.png`,
    companyId: defaultCompanyId(sequence),
  }),
});

export const invoiceFactory = defineFactory({
  schema: factorySchema,
  table: "invoices",
  // use を withFactory に alias する: `use` で始まる名前だと eslint react-hooks/rules-of-hooks が
  // React の use フックと誤認するため (実体は drizzle-factory の関連生成関数)。
  resolver: ({ sequence, use: withFactory }) => ({
    id: crypto.randomUUID(),
    amount: 1000 + sequence,
    status: "pending",
    date: "2026-01-01",
    // customerId 未指定時のみ customer を関連生成する (遅延評価)。
    // 注意: 自動生成 customer は別 sequence の companyId を持ち invoice の companyId と一致しない。
    // 「自社 customerId で作成成功」等の isolation テストでは customerId を明示すること
    // (drizzle-factory は resolver field 間で override 値を共有できないため自動継承は不可)。
    customerId: () =>
      withFactory(customerFactory)
        .create()
        .then((c) => c.id),
    createdAt: "2026-01-01 00:00:00",
    updatedAt: "2026-01-01 00:00:00",
    companyId: defaultCompanyId(sequence),
  }),
});

export const revenueFactory = defineFactory({
  schema: factorySchema,
  table: "revenue",
  resolver: ({ sequence }) => ({
    // month 単独 unique (PR-5 で (company_id, month) 化) のため sequence でユニークにする。
    month: String(sequence).padStart(4, "0"),
    revenue: 10000 + sequence,
    createdAt: "2026-01-01 00:00:00",
    updatedAt: "2026-01-01 00:00:00",
    companyId: defaultCompanyId(sequence),
  }),
});

export const factory = composeFactory({
  user: userFactory,
  customer: customerFactory,
  invoice: invoiceFactory,
  revenue: revenueFactory,
});
