ALTER TABLE "customers" ADD COLUMN "company_id" varchar(32);--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "company_id" varchar(32);--> statement-breakpoint
ALTER TABLE "revenue" ADD COLUMN "company_id" varchar(32);--> statement-breakpoint
CREATE INDEX "customers_company_id_idx" ON "customers" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "invoices_company_id_idx" ON "invoices" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "revenue_company_id_idx" ON "revenue" USING btree ("company_id");