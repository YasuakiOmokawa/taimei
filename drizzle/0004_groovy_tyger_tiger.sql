-- NOT NULL 化の前に straggler な NULL 行を placeholder で backfill する (forward-only・冪等)。
-- ops の手動 backfill 漏れがあっても NOT NULL 化が失敗しない安全網。
-- 設計詳細: docs/adr/0002-company-data-scoping.md (D9 / expand-contract の contract 段)。
UPDATE "customers" SET "company_id" = 'cmp_backfill_placeholder' WHERE "company_id" IS NULL;--> statement-breakpoint
UPDATE "invoices" SET "company_id" = 'cmp_backfill_placeholder' WHERE "company_id" IS NULL;--> statement-breakpoint
UPDATE "revenue" SET "company_id" = 'cmp_backfill_placeholder' WHERE "company_id" IS NULL;--> statement-breakpoint
-- revenue_month_key は環境で実体が異なる (本番=旧ツール由来の UNIQUE constraint /
-- test・dev=drizzle 0000 由来の index)。constraint は DROP INDEX で落とせないため両構えで落とす。
-- constraint を落とせば裏付け index も消え、後段の DROP INDEX IF EXISTS は no-op になる。
-- 設計詳細: docs/adr/0002-company-data-scoping.md (D-4)。
ALTER TABLE "revenue" DROP CONSTRAINT IF EXISTS "revenue_month_key";--> statement-breakpoint
DROP INDEX IF EXISTS "revenue_month_key";--> statement-breakpoint
ALTER TABLE "customers" ALTER COLUMN "company_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "company_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "revenue" ALTER COLUMN "company_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "revenue_company_month_key" ON "revenue" USING btree ("company_id","month");