CREATE FUNCTION "mark_team_list_unbumped"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM set_config('app.team_list_unbumped', 'on', true);
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE FUNCTION "require_team_list_bumped"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_setting('app.team_list_unbumped', true) = 'on' THEN
    RAISE EXCEPTION 'teams・team_assignments を書いた transaction は、書いた後に同じ transaction で bump_company_team_list を呼んでから commit する (src/services/company-team-list.ts の writeTeamList、docs/adr/0008-company-teams-cache.md)';
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER "team_list_unbumped" AFTER INSERT OR UPDATE OR DELETE ON "teams" FOR EACH ROW EXECUTE FUNCTION "mark_team_list_unbumped"();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "team_list_bumped" AFTER INSERT OR UPDATE OR DELETE ON "teams" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "require_team_list_bumped"();
--> statement-breakpoint
CREATE TRIGGER "team_list_unbumped" AFTER INSERT OR UPDATE OR DELETE ON "team_assignments" FOR EACH ROW EXECUTE FUNCTION "mark_team_list_unbumped"();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER "team_list_bumped" AFTER INSERT OR UPDATE OR DELETE ON "team_assignments" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "require_team_list_bumped"();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "bump_company_team_list"(p_company_id varchar)
RETURNS json LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
BEGIN
  PERFORM set_config('app.company_id', p_company_id, true);
  INSERT INTO company_team_list_versions AS v (company_id, version) VALUES (p_company_id, 1)
  ON CONFLICT (company_id) DO UPDATE SET version = v.version + 1;
  PERFORM set_config('app.team_list_unbumped', '', true);
  RETURN company_team_list(p_company_id);
END $$;
