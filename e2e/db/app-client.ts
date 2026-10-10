import { Pool } from "pg";

// taimei の DB (e2e では superuser で接続し、RLS を通らない)。チームを作る画面 (#584) の代わりに直に入れる
const appDb = new Pool({ connectionString: process.env.APP_DATABASE_URL });

export const insertTeam = async (companyId: string, name: string) => {
  const { rows } = await appDb.query<{ id: string }>(
    "INSERT INTO teams (company_id, name) VALUES ($1, $2) RETURNING id",
    [companyId, name],
  );
  return rows[0].id;
};
