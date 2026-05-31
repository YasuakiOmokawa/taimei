-- tags / tags2 を社ごとのラベル辞書として scope する。設計詳細: docs/adr/0002-company-data-scoping.md。
-- ADD COLUMN ... NOT NULL を直接実行すると本番の既存行が制約違反で失敗するため、
-- nullable 追加 → 冪等 backfill (placeholder) → NOT NULL 化 の順に展開する (D9 / PR-5 D-4 の踏襲)。
-- tags は書き込みアプリ経路が存在しない (Tag2Service は read のみ) ため、nullable 期間に
-- company_id なし INSERT が走る競合は起きず、expand/contract を別 PR に分ける必要はない。
ALTER TABLE "tags" ADD COLUMN "company_id" varchar(32);--> statement-breakpoint
ALTER TABLE "tags2" ADD COLUMN "company_id" varchar(32);--> statement-breakpoint
UPDATE "tags" SET "company_id" = 'cmp_backfill_placeholder' WHERE "company_id" IS NULL;--> statement-breakpoint
UPDATE "tags2" SET "company_id" = 'cmp_backfill_placeholder' WHERE "company_id" IS NULL;--> statement-breakpoint
ALTER TABLE "tags" ALTER COLUMN "company_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "tags2" ALTER COLUMN "company_id" SET NOT NULL;--> statement-breakpoint
CREATE INDEX "tags_company_id_idx" ON "tags" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "tags2_company_id_idx" ON "tags2" USING btree ("company_id");
