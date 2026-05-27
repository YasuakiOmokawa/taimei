-- 既存行の company_id backfill。設計詳細: docs/adr/0002-company-data-scoping.md (D9)。
--
-- drizzle/manual/ は drizzle-kit の journal 管理外で、`drizzle-kit migrate` では適用されない。
-- リリース時に ops が手動実行する。NOT NULL 化 migration の前に必ず流すこと
-- (NOT NULL を先に適用すると既存 NULL 行で制約違反になり migration が abort するため)。
--
-- placeholder は auth の実 company.id に結合しない固定値にする (cross-DB 結合を避ける)。
-- 意味あるデータは signup フロー / factory 由来であり、この backfill は
-- 「リリース時点で残っていた既存行を NOT NULL 化可能にする」ためだけのもの。
-- 冪等: company_id IS NULL の行だけを対象にするため複数回流しても安全 (2 回目以降は 0 行)。

UPDATE "customers" SET "company_id" = 'cmp_backfill_placeholder' WHERE "company_id" IS NULL;
UPDATE "invoices" SET "company_id" = 'cmp_backfill_placeholder' WHERE "company_id" IS NULL;
UPDATE "revenue" SET "company_id" = 'cmp_backfill_placeholder' WHERE "company_id" IS NULL;
