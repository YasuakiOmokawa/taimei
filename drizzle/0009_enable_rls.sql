ALTER TABLE "member_skills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "skills" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "team_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "company_isolation" ON "member_skills" AS PERMISSIVE FOR ALL TO public USING ("member_skills"."company_id" = current_setting('app.company_id', true)) WITH CHECK ("member_skills"."company_id" = current_setting('app.company_id', true));--> statement-breakpoint
CREATE POLICY "company_isolation" ON "skills" AS PERMISSIVE FOR ALL TO public USING ("skills"."company_id" = current_setting('app.company_id', true)) WITH CHECK ("skills"."company_id" = current_setting('app.company_id', true));--> statement-breakpoint
CREATE POLICY "company_isolation" ON "team_assignments" AS PERMISSIVE FOR ALL TO public USING ("team_assignments"."company_id" = current_setting('app.company_id', true)) WITH CHECK ("team_assignments"."company_id" = current_setting('app.company_id', true));--> statement-breakpoint
CREATE POLICY "company_isolation" ON "teams" AS PERMISSIVE FOR ALL TO public USING ("teams"."company_id" = current_setting('app.company_id', true)) WITH CHECK ("teams"."company_id" = current_setting('app.company_id', true));