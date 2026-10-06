-- 日次の照合 (app/lib/purge-departed.ts) が、RLS の下で全事業所を列挙するための関数。owner の権限で動き、事業所の id だけを返す (docs/adr/0005)
CREATE FUNCTION "company_ids_with_teams"() RETURNS SETOF varchar
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT DISTINCT "company_id" FROM "teams" $$;
