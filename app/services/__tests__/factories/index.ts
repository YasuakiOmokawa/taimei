import { composeFactory, defineFactory } from "@praha/drizzle-factory";
import { factorySchema } from "./test-schema";

// test-db.ts が既存の import パス (../factories) を維持できるよう re-export する。
export { testTableSchema } from "./test-schema";

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
    // revenue unique は (company_id, month) 複合 (PR-5 で month 単独から変更)。同一 company で
    // 複数行を作るテストでも (company_id, month) 衝突しないよう month を sequence でユニーク化する。
    month: String(sequence).padStart(4, "0"),
    revenue: 10000 + sequence,
    createdAt: "2026-01-01 00:00:00",
    updatedAt: "2026-01-01 00:00:00",
    companyId: defaultCompanyId(sequence),
  }),
});

export const tag2Factory = defineFactory({
  schema: factorySchema,
  table: "tags2",
  resolver: ({ sequence }) => ({
    id: crypto.randomUUID(),
    name: `Tag ${sequence}`,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    companyId: defaultCompanyId(sequence),
  }),
});

export const factory = composeFactory({
  user: userFactory,
  customer: customerFactory,
  invoice: invoiceFactory,
  revenue: revenueFactory,
  tag2: tag2Factory,
});
