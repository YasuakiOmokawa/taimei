import { Pool, type PoolClient } from "pg";

const appDb = new Pool({ connectionString: process.env.APP_DATABASE_URL });

const writeAndBumpTeamList = async <T>(
  companyId: string,
  write: (client: PoolClient) => Promise<T>,
) => {
  const client = await appDb.connect();
  try {
    await client.query("BEGIN");
    const written = await write(client);
    await client.query("SELECT bump_company_team_list($1)", [companyId]);
    await client.query("COMMIT");
    client.release();
    return written;
  } catch (error) {
    client.release(true);
    throw error;
  }
};

export const insertTeam = (companyId: string, name: string) =>
  writeAndBumpTeamList(companyId, async (client) => {
    const { rows } = await client.query<{ id: string }>(
      "INSERT INTO teams (company_id, name) VALUES ($1, $2) RETURNING id",
      [companyId, name],
    );
    return rows[0].id;
  });

export const insertSkill = async (
  companyId: string,
  teamId: string,
  name: string,
) => {
  const { rows } = await appDb.query<{ id: string }>(
    "INSERT INTO skills (company_id, team_id, name) VALUES ($1, $2, $3) RETURNING id",
    [companyId, teamId, name],
  );
  return rows[0].id;
};

export const assignMember = (
  companyId: string,
  teamId: string,
  userId: string,
) =>
  writeAndBumpTeamList(companyId, (client) =>
    client.query(
      "INSERT INTO team_assignments (company_id, team_id, user_id) VALUES ($1, $2, $3)",
      [companyId, teamId, userId],
    ),
  );

export const insertLevel = (
  companyId: string,
  teamId: string,
  skillId: string,
  userId: string,
  level: number,
) =>
  appDb.query(
    "INSERT INTO member_skills (company_id, team_id, skill_id, user_id, level, wants_to_learn) VALUES ($1, $2, $3, $4, $5, false)",
    [companyId, teamId, skillId, userId, level],
  );
