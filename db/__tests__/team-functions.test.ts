import { type SQL, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import { describe, expect, it } from "vitest";
import * as schema from "@/db/drizzle/schema";
import { TEST_DATABASE_URL } from "@/src/services/__tests__/db/global-setup";
import {
  COMPANY_A,
  COMPANY_B,
  createdAtMinute,
  fixtureCompanyId,
  seedAssignment,
  seedLevel,
  seedSkill,
  seedTeam,
} from "@/src/services/__tests__/db/seed";
import {
  asAppRole,
  currentCompanySetting,
  functionValue,
  type TestDb,
  withCommitCheck,
  withRollback,
} from "@/src/services/__tests__/db/test-db";

const COMPANY_EMPTY = fixtureCompanyId("empty");
const teamIdsOf = (value: unknown) =>
  (value as { teams: { id: string }[] }).teams.map((team) => team.id);

const EXPLICIT_COMPANY_FILTER = /\b\w+\.company_id = p_company_id\b/g;

const replaceWithRlsOnlyVersion = async (tx: TestDb, name: string) => {
  const { rows } = await tx.execute<{ definition: string }>(
    sql`select pg_get_functiondef(${name}::regproc) as definition`,
  );
  const definition = rows[0].definition;
  expect(
    definition.match(EXPLICIT_COMPANY_FILTER),
    `${name} の中の事業所の絞り込みは <別名>.company_id = p_company_id で書く`,
  ).not.toBeNull();
  await tx.execute(
    sql.raw(definition.replace(EXPLICIT_COMPANY_FILTER, "TRUE")),
  );
};

describe("明示の絞り込みを外しても、RLS だけで他社が見えない", () => {
  it("team_matrix は他社のチームを null にし、自社のチームを返す", () =>
    withRollback(async (tx) => {
      const own = await seedTeam(tx, COMPANY_A, "A のチーム");
      const other = await seedTeam(tx, COMPANY_B, "B のチーム");
      await replaceWithRlsOnlyVersion(tx, "team_matrix");
      await replaceWithRlsOnlyVersion(tx, "team_visible_to");
      const matrixOf = (teamId: string) =>
        asAppRole(tx, async (app) => {
          const { rows } = await app.execute<{ team: unknown }>(
            sql`select team_matrix(${COMPANY_A}, ${teamId}, 'u_1', true) as team`,
          );
          return rows[0].team;
        });

      expect(await matrixOf(other)).toBeNull();
      expect(await matrixOf(own)).not.toBeNull();
    }));

  it("company_team_list と bump_company_team_list は自社のチームだけを返す", () =>
    withRollback(async (tx) => {
      const own = await seedTeam(tx, COMPANY_A, "A のチーム");
      const other = await seedTeam(tx, COMPANY_B, "B のチーム");
      await replaceWithRlsOnlyVersion(tx, "company_team_list");
      for (const call of [
        sql`company_team_list(${COMPANY_A})`,
        sql`bump_company_team_list(${COMPANY_A})`,
      ]) {
        const ids = teamIdsOf(
          await asAppRole(tx, (app) => functionValue(app, call)),
        );
        expect(ids).toContain(own);
        expect(ids).not.toContain(other);
      }
    }));

  it("team_list は自社のチームだけを返す", () =>
    withRollback(async (tx) => {
      const own = await seedTeam(tx, COMPANY_A, "A のチーム");
      const other = await seedTeam(tx, COMPANY_B, "B のチーム");
      await replaceWithRlsOnlyVersion(tx, "team_list");
      await replaceWithRlsOnlyVersion(tx, "team_visible_to");
      const { rows } = await asAppRole(tx, (app) =>
        app.execute<{ teams: { id: string }[] }>(
          sql`select team_list(${COMPANY_A}, 'u_1', true) as teams`,
        ),
      );

      const ids = rows[0].teams.map((team) => team.id);
      expect(ids).toContain(own);
      expect(ids).not.toContain(other);
    }));
});

describe("company_team_list と bump_company_team_list", () => {
  const listOf = (tx: TestDb, call: SQL) =>
    functionValue(tx, call) as Promise<{
      version: number;
      teams: { id: string; name: string; assignedUserIds: string[] }[];
    }>;

  it("版の行が無い事業所は版 0 と、全チームを作成の古い順に id・名前・割り当てた人で返す", () =>
    withRollback(async (tx) => {
      const later = await seedTeam(tx, COMPANY_A, "後", createdAtMinute(2));
      const earlier = await seedTeam(tx, COMPANY_A, "先", createdAtMinute(1));
      await seedAssignment(tx, COMPANY_A, earlier, "u_2");
      await seedAssignment(tx, COMPANY_A, earlier, "u_1");
      await seedTeam(tx, COMPANY_B, "他社");

      expect(await listOf(tx, sql`company_team_list(${COMPANY_A})`)).toEqual({
        version: 0,
        teams: [
          { id: earlier, name: "先", assignedUserIds: ["u_1", "u_2"] },
          { id: later, name: "後", assignedUserIds: [] },
        ],
      });
    }));

  it("チームの無い事業所は版 0 と空の一覧を返す", () =>
    withRollback(async (tx) => {
      expect(
        await listOf(tx, sql`company_team_list(${COMPANY_EMPTY})`),
      ).toEqual({
        version: 0,
        teams: [],
      });
    }));

  it("版の行が無い事業所の bump は版 1 を返し、版の行を作る", () =>
    withRollback(async (tx) => {
      expect(
        (await listOf(tx, sql`bump_company_team_list(${COMPANY_A})`)).version,
      ).toBe(1);
      expect(
        (await listOf(tx, sql`company_team_list(${COMPANY_A})`)).version,
      ).toBe(1);
    }));

  it("bump を 2 回呼んだ後の版は 2", () =>
    withRollback(async (tx) => {
      await functionValue(tx, sql`bump_company_team_list(${COMPANY_A})`);
      await functionValue(tx, sql`bump_company_team_list(${COMPANY_A})`);

      expect(
        (await listOf(tx, sql`company_team_list(${COMPANY_A})`)).version,
      ).toBe(2);
    }));

  it("同じ transaction でチームを書いた後の bump は、版を 1 増やし、書いたチームを含む一覧を返す", () =>
    withRollback(async (tx) => {
      await functionValue(tx, sql`bump_company_team_list(${COMPANY_A})`);
      const written = await seedTeam(tx, COMPANY_A, "書いたチーム");

      const bumped = await listOf(
        tx,
        sql`bump_company_team_list(${COMPANY_A})`,
      );

      expect(bumped.version).toBe(2);
      expect(bumped.teams.map((team) => team.id)).toContain(written);
    }));
});

describe("関数の set_config は、同じ接続の次の文に漏れない", () => {
  // withRollback の中では外側の transaction の終わりまで設定が残るので、transaction の外の接続で見る
  const companySettingAfter = async (call: string) => {
    const client = new Client({ connectionString: TEST_DATABASE_URL });
    await client.connect();
    try {
      await client.query(call);
      return await currentCompanySetting(drizzle(client, { schema }));
    } finally {
      await client.end();
    }
  };

  it.each([
    [
      "team_matrix",
      `select team_matrix('${COMPANY_A}', '${crypto.randomUUID()}', 'u_1', true)`,
    ],
    ["team_list", `select team_list('${COMPANY_A}', 'u_1', true)`],
    ["company_team_list", `select company_team_list('${COMPANY_A}')`],
  ])("%s", async (_, call) => {
    expect(await companySettingAfter(call)).toBeFalsy();
  });
});

it("事業所のデータを読む SQL の関数は、呼んだ文の中だけに事業所を設定し、呼んだ role の RLS で読む (例外は事業所をまたぐ定期処理の company_ids_with_teams と、呼ぶ側が設定する team_visible_to。行を読まない trigger の関数 mark_team_list_unbumped・require_team_list_bumped も除く)", () =>
  withRollback(async (tx) => {
    const { rows } = await tx.execute<{
      name: string;
      securityDefiner: boolean;
      definition: string;
    }>(
      sql`select proname as "name", prosecdef as "securityDefiner", pg_get_functiondef(oid) as "definition" from pg_proc where pronamespace = 'public'::regnamespace and proname not in ('company_ids_with_teams', 'team_visible_to', 'mark_team_list_unbumped', 'require_team_list_bumped') order by proname`,
    );

    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows
        .filter(
          ({ securityDefiner, definition }) =>
            securityDefiner ||
            !definition.includes(
              "set_config('app.company_id', p_company_id, true)",
            ),
        )
        .map(({ name }) => name),
    ).toEqual([]);
  }));

describe("一覧の元の表 (teams・team_assignments) を書いた transaction の commit", () => {
  const commitChecked = (tx: TestDb, write: (sp: TestDb) => Promise<unknown>) =>
    tx.transaction((sp) => withCommitCheck(sp, write).then(() => undefined));
  const bump = (sp: TestDb) =>
    functionValue(sp, sql`bump_company_team_list(${COMPANY_A})`);

  it.each([
    ["teams の INSERT", (sp: TestDb) => seedTeam(sp, COMPANY_A, "新")],
    [
      "teams の UPDATE",
      (sp: TestDb, teamId: string) =>
        sp.execute(sql`update teams set name = '新' where id = ${teamId}`),
    ],
    [
      "teams の DELETE",
      (sp: TestDb, teamId: string) =>
        sp.execute(sql`delete from teams where id = ${teamId}`),
    ],
    [
      "team_assignments の INSERT",
      (sp: TestDb, teamId: string) =>
        sp.execute(
          sql`insert into team_assignments (company_id, team_id, user_id) values (${COMPANY_A}, ${teamId}, 'u_new')`,
        ),
    ],
    [
      "team_assignments の DELETE",
      (sp: TestDb) =>
        sp.execute(sql`delete from team_assignments where user_id = 'u_1'`),
    ],
  ])(
    "%s の後に bump_company_team_list を呼ばない transaction は commit の検査で落ちる (deferred の制約は ROLLBACK では走らないので、IMMEDIATE にして観測する)",
    (_, write) =>
      withRollback(async (tx) => {
        const teamId = await seedTeam(tx, COMPANY_A, "開発");
        await seedAssignment(tx, COMPANY_A, teamId, "u_1");

        await expect(
          commitChecked(tx, (sp) => write(sp, teamId)),
        ).rejects.toMatchObject({
          cause: { message: expect.stringContaining("bump_company_team_list") },
        });
      }),
  );

  it("書いた後に bump_company_team_list を呼んだ transaction は commit の検査を通る", () =>
    withRollback(async (tx) => {
      await expect(
        commitChecked(tx, async (sp) => {
          await seedTeam(sp, COMPANY_A, "新");
          await bump(sp);
        }),
      ).resolves.toBeUndefined();
    }));

  it("bump_company_team_list の後に書いた transaction は commit の検査で落ちる", () =>
    withRollback(async (tx) => {
      await expect(
        commitChecked(tx, async (sp) => {
          await seedTeam(sp, COMPANY_A, "先");
          await bump(sp);
          await seedTeam(sp, COMPANY_A, "後");
        }),
      ).rejects.toMatchObject({
        cause: { message: expect.stringContaining("bump_company_team_list") },
      });
    }));

  it("skills・member_skills だけを書いた transaction は、版を増やさずに commit の検査を通る", () =>
    withRollback(async (tx) => {
      const teamId = await seedTeam(tx, COMPANY_A, "開発");
      await seedAssignment(tx, COMPANY_A, teamId, "u_1");

      await expect(
        commitChecked(tx, async (sp) => {
          const skillId = await seedSkill(sp, COMPANY_A, teamId, "設計");
          await seedLevel(sp, {
            companyId: COMPANY_A,
            teamId,
            skillId,
            userId: "u_1",
          });
        }),
      ).resolves.toBeUndefined();
    }));

  it("該当の行の無い teams の DELETE だけの transaction は、版を増やさずに commit の検査を通る", () =>
    withRollback(async (tx) => {
      await expect(
        commitChecked(tx, (sp) =>
          sp.execute(sql`delete from teams where name = '無いチーム'`),
        ),
      ).resolves.toBeUndefined();
    }));
});
