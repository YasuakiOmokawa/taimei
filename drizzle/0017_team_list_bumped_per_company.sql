CREATE OR REPLACE FUNCTION "mark_team_list_unbumped"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  unbumped jsonb := coalesce(nullif(current_setting('app.team_list_unbumped_companies', true), ''), '{}')::jsonb;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    unbumped := unbumped || jsonb_build_object(OLD.company_id, true);
  END IF;
  IF TG_OP <> 'DELETE' THEN
    unbumped := unbumped || jsonb_build_object(NEW.company_id, true);
  END IF;
  PERFORM set_config('app.team_list_unbumped_companies', unbumped::text, true);
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "require_team_list_bumped"()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  unbumped text := (
    SELECT string_agg(company_id, ', ')
    FROM jsonb_object_keys(coalesce(nullif(current_setting('app.team_list_unbumped_companies', true), ''), '{}')::jsonb) AS company_id
  );
BEGIN
  IF unbumped IS NOT NULL THEN
    RAISE EXCEPTION 'teams・team_assignments を書いた transaction は、書いた事業所ごとに、書いた後に同じ transaction で bump_company_team_list を呼んでから commit する (bump していない事業所: %。src/services/company-team-list.ts の writeTeamList、docs/adr/0008-company-teams-cache.md)', unbumped;
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION "bump_company_team_list"(p_company_id varchar)
RETURNS json LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
BEGIN
  PERFORM set_config('app.company_id', p_company_id, true);
  INSERT INTO company_team_list_versions AS v (company_id, version) VALUES (p_company_id, 1)
  ON CONFLICT (company_id) DO UPDATE SET version = v.version + 1;
  PERFORM set_config(
    'app.team_list_unbumped_companies',
    (coalesce(nullif(current_setting('app.team_list_unbumped_companies', true), ''), '{}')::jsonb - p_company_id::text)::text,
    true
  );
  RETURN company_team_list(p_company_id);
END $$;
