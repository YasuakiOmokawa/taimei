import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { testDb } from "./test-db";

// migration の最終状態 (NOT NULL 化 + revenue unique 複合化 + index) を実 DB スキーマで検証する。
// global-setup が drizzle-kit migrate で全 migration を適用済の test DB を対象にする。
// 設計詳細: docs/adr/0002-company-data-scoping.md。
describe("company_id scoping migration", () => {
  it("customers/invoices/revenue/tags/tags2 の company_id が NOT NULL である", async () => {
    const res = await testDb.execute(sql`
      SELECT table_name, is_nullable
      FROM information_schema.columns
      WHERE table_name IN ('customers', 'invoices', 'revenue', 'tags', 'tags2')
        AND column_name = 'company_id'
      ORDER BY table_name
    `);
    const rows = res.rows as { table_name: string; is_nullable: string }[];
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      expect(row.is_nullable).toBe("NO");
    }
  });

  it("revenue の unique は (company_id, month) のみで (month) 単独は残らない", async () => {
    const res = await testDb.execute(sql`
      SELECT indexname FROM pg_indexes WHERE tablename = 'revenue'
    `);
    const names = (res.rows as { indexname: string }[]).map((r) => r.indexname);
    expect(names).toContain("revenue_company_month_key");
    expect(names).not.toContain("revenue_month_key");
  });

  it("company_id index が customers/invoices/revenue/tags/tags2 に存在する", async () => {
    const res = await testDb.execute(sql`
      SELECT indexname FROM pg_indexes
      WHERE indexname IN (
        'customers_company_id_idx',
        'invoices_company_id_idx',
        'revenue_company_id_idx',
        'tags_company_id_idx',
        'tags2_company_id_idx'
      )
    `);
    expect(res.rows).toHaveLength(5);
  });

  it("company_id に NULL 行が残っていない (backfill 検証)", async () => {
    const res = await testDb.execute(sql`
      SELECT
        (SELECT count(*) FROM customers WHERE company_id IS NULL) AS customers,
        (SELECT count(*) FROM invoices WHERE company_id IS NULL) AS invoices,
        (SELECT count(*) FROM revenue WHERE company_id IS NULL) AS revenue,
        (SELECT count(*) FROM tags WHERE company_id IS NULL) AS tags,
        (SELECT count(*) FROM tags2 WHERE company_id IS NULL) AS tags2
    `);
    const row = (
      res.rows as {
        customers: string;
        invoices: string;
        revenue: string;
        tags: string;
        tags2: string;
      }[]
    )[0];
    expect(Number(row.customers)).toBe(0);
    expect(Number(row.invoices)).toBe(0);
    expect(Number(row.revenue)).toBe(0);
    expect(Number(row.tags)).toBe(0);
    expect(Number(row.tags2)).toBe(0);
  });
});
