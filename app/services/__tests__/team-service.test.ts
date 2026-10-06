import type { Role } from "@taimei-code/auth-client";
import { count, eq, type SQL } from "drizzle-orm";
import { Effect, Layer, Result } from "effect";
import { describe, expect, it } from "vitest";
import { skills, teamAssignments, teams } from "@/db/drizzle/schema";
import { AuthorizationContext } from "../authorization-context";
import { CompanyContext } from "../company-context";
import { CompanyMembers, MemberListError } from "../company-members-service";
import { Db } from "../db-service";
import { TeamService } from "../team-service";
import { type TestDb, withRollback } from "./db/test-db";

type Actor = {
  companyId: string;
  userId: string;
  role: Role | undefined;
  companyMemberIds?: readonly string[] | "listMembersFails";
};

const ADMIN: Actor = { companyId: "cmp_a", userId: "u_admin", role: "ADMIN" };
const MEMBER: Actor = { companyId: "cmp_a", userId: "u_m", role: "MEMBER" };
const NO_ROLE: Actor = { companyId: "cmp_a", userId: "u_m", role: undefined };

const companyMembersLayer = (
  companyMemberIds: Actor["companyMemberIds"] = [],
) =>
  CompanyMembers.layerTest(
    companyMemberIds === "listMembersFails"
      ? Effect.fail(new MemberListError({ cause: "rpc failed" }))
      : Effect.succeed(
          companyMemberIds.map((userId) => ({ userId, name: "", email: "" })),
        ),
  );

const runAs =
  (tx: TestDb, actor: Actor) =>
  <A, E>(
    f: (
      service: TeamService["Service"],
    ) => Effect.Effect<A, E, CompanyContext | AuthorizationContext>,
  ) =>
    Effect.runPromise(
      Effect.result(
        TeamService.use(f).pipe(
          Effect.provide(
            TeamService.layer.pipe(
              Layer.provide(Layer.succeed(Db, tx)),
              Layer.provide(companyMembersLayer(actor.companyMemberIds)),
            ),
          ),
          Effect.provideService(CompanyContext, {
            companyId: actor.companyId,
          }),
          Effect.provideService(AuthorizationContext, {
            userId: actor.userId,
            role: actor.role,
          }),
        ),
      ),
    );

const failureTag = <A, E extends { _tag: string }>(
  result: Result.Result<A, E>,
) => (Result.isFailure(result) ? result.failure._tag : "success");

const seedTeam = async (
  tx: TestDb,
  companyId: string,
  name: string,
  createdAt?: Date,
) => {
  const [row] = await tx
    .insert(teams)
    .values({ companyId, name, createdAt })
    .returning({ id: teams.id });
  return row.id;
};

const seedSkill = async (
  tx: TestDb,
  companyId: string,
  teamId: string,
  name: string,
  createdAt?: Date,
) => {
  const [row] = await tx
    .insert(skills)
    .values({ companyId, teamId, name, createdAt })
    .returning({ id: skills.id });
  return row.id;
};

const seedAssignment = (
  tx: TestDb,
  companyId: string,
  teamId: string,
  userId: string,
) => tx.insert(teamAssignments).values({ companyId, teamId, userId });

const countRows = async (
  tx: TestDb,
  table: typeof teams | typeof skills | typeof teamAssignments,
  where?: SQL,
) => {
  const [row] = await tx.select({ n: count() }).from(table).where(where);
  return row.n;
};

const teamName = async (tx: TestDb, id: string) => {
  const [row] = await tx
    .select({ name: teams.name })
    .from(teams)
    .where(eq(teams.id, id));
  return row?.name;
};

const createdAtMinute = (minute: number) =>
  new Date(Date.UTC(2026, 0, 1, 0, minute));

describe("createTeam", () => {
  it("管理者は自社のチームを作れる。名前の前後の空白は除く", () =>
    withRollback(async (tx) => {
      const result = await runAs(tx, ADMIN)((s) => s.createTeam("  開発  "));

      const { id } = Result.getOrThrow(result);
      const rows = await tx.select().from(teams).where(eq(teams.id, id));
      expect(rows).toMatchObject([{ companyId: "cmp_a", name: "開発" }]);
    }));

  it.each([
    ["MEMBER", MEMBER],
    ["role の無い人", NO_ROLE],
  ])("%s は作れない", (_, actor) =>
    withRollback(async (tx) => {
      const before = await countRows(tx, teams);

      const result = await runAs(tx, actor)((s) => s.createTeam("開発"));

      expect(failureTag(result)).toBe("NotManager");
      expect(await countRows(tx, teams)).toBe(before);
    }),
  );

  it("空白だけの名前では作れない", () =>
    withRollback(async (tx) => {
      const before = await countRows(tx, teams);

      const result = await runAs(tx, ADMIN)((s) => s.createTeam("   "));

      expect(failureTag(result)).toBe("InvalidName");
      expect(await countRows(tx, teams)).toBe(before);
    }));

  it("同じ事業所に同じ名前のチームは作れず、他社とは同じ名前でよい", () =>
    withRollback(async (tx) => {
      await seedTeam(tx, "cmp_a", "開発");
      await seedTeam(tx, "cmp_b", "営業");
      const before = await countRows(tx, teams);
      const admin = runAs(tx, ADMIN);

      const duplicate = await admin((s) => s.createTeam(" 開発 "));
      const otherCompanyName = await admin((s) => s.createTeam("営業"));

      expect(failureTag(duplicate)).toBe("DuplicateName");
      expect(failureTag(otherCompanyName)).toBe("success");
      expect(await countRows(tx, teams)).toBe(before + 1);
    }));
});

describe("listTeams", () => {
  it("管理者には自社の全チームを作成の古い順で返し、他社のチームを返さない", () =>
    withRollback(async (tx) => {
      const later = await seedTeam(tx, "cmp_a", "後", createdAtMinute(2));
      const earlier = await seedTeam(tx, "cmp_a", "先", createdAtMinute(1));
      await seedTeam(tx, "cmp_b", "他社", createdAtMinute(0));

      const result = await runAs(tx, ADMIN)((s) => s.listTeams());

      expect(Result.getOrThrow(result).map((t) => t.id)).toEqual([
        earlier,
        later,
      ]);
    }));

  it.each([
    ["MEMBER", MEMBER],
    ["role の無い人", NO_ROLE],
  ])("%s には割り当てられたチームだけを返す", (_, actor) =>
    withRollback(async (tx) => {
      const x = await seedTeam(tx, "cmp_a", "X");
      await seedTeam(tx, "cmp_a", "Y");
      await seedAssignment(tx, "cmp_a", x, "u_m");

      const result = await runAs(tx, actor)((s) => s.listTeams());

      expect(Result.getOrThrow(result).map((t) => t.id)).toEqual([x]);
    }),
  );

  it("どのチームにも割り当てられていない MEMBER には何も返さない", () =>
    withRollback(async (tx) => {
      await seedTeam(tx, "cmp_a", "X");

      const result = await runAs(tx, MEMBER)((s) => s.listTeams());

      expect(Result.getOrThrow(result)).toEqual([]);
    }));

  it("1 人を 2 つのチームに割り当てられ、その人には両方を返す", () =>
    withRollback(async (tx) => {
      const x = await seedTeam(tx, "cmp_a", "X", createdAtMinute(1));
      const y = await seedTeam(tx, "cmp_a", "Y", createdAtMinute(2));
      const admin = runAs(tx, { ...ADMIN, companyMemberIds: ["u_m"] });
      await admin((s) => s.assign(x, "u_m"));
      await admin((s) => s.assign(y, "u_m"));

      const result = await runAs(tx, MEMBER)((s) => s.listTeams());

      expect(await countRows(tx, teamAssignments)).toBe(2);
      expect(Result.getOrThrow(result).map((t) => t.id)).toEqual([x, y]);
    }));
});

describe("getTeam", () => {
  it("管理者には名前・作成の古い順のスキル・割り当てた user id を返す", () =>
    withRollback(async (tx) => {
      const id = await seedTeam(tx, "cmp_a", "開発");
      const second = await seedSkill(
        tx,
        "cmp_a",
        id,
        "テスト",
        createdAtMinute(2),
      );
      const first = await seedSkill(
        tx,
        "cmp_a",
        id,
        "設計",
        createdAtMinute(1),
      );
      await seedAssignment(tx, "cmp_a", id, "u_1");
      await seedAssignment(tx, "cmp_a", id, "u_2");

      const result = await runAs(tx, ADMIN)((s) => s.getTeam(id));

      const team = Result.getOrThrow(result);
      expect(team.name).toBe("開発");
      expect(team.skills.map((skill) => skill.id)).toEqual([first, second]);
      expect([...team.assignedUserIds].sort()).toEqual(["u_1", "u_2"]);
    }));

  it("他社のチームは見つからない", () =>
    withRollback(async (tx) => {
      const id = await seedTeam(tx, "cmp_b", "他社");

      const result = await runAs(tx, ADMIN)((s) => s.getTeam(id));

      expect(failureTag(result)).toBe("TeamNotFound");
    }));

  it("MEMBER には割り当てられたチームだけが見つかる", () =>
    withRollback(async (tx) => {
      const x = await seedTeam(tx, "cmp_a", "X");
      const y = await seedTeam(tx, "cmp_a", "Y");
      await seedAssignment(tx, "cmp_a", x, "u_m");
      const member = runAs(tx, MEMBER);

      expect(failureTag(await member((s) => s.getTeam(y)))).toBe(
        "TeamNotFound",
      );
      expect(failureTag(await member((s) => s.getTeam(x)))).toBe("success");
    }));

  it("他社のチームへの割り当ては、自社の事業所で開いても見えない", () =>
    withRollback(async (tx) => {
      const other = await seedTeam(tx, "cmp_b", "他社");
      await seedAssignment(tx, "cmp_b", other, "u_m");
      const member = runAs(tx, MEMBER);

      expect(Result.getOrThrow(await member((s) => s.listTeams()))).toEqual([]);
      expect(failureTag(await member((s) => s.getTeam(other)))).toBe(
        "TeamNotFound",
      );
    }));

  it("UUID でない id は DB の失敗ではなく見つからない", () =>
    withRollback(async (tx) => {
      const result = await runAs(tx, ADMIN)((s) => s.getTeam("not-a-uuid"));

      expect(failureTag(result)).toBe("TeamNotFound");
    }));
});

describe("renameTeam", () => {
  it("管理者は名前を変えられる。名前の前後の空白は除く", () =>
    withRollback(async (tx) => {
      const id = await seedTeam(tx, "cmp_a", "旧");

      await runAs(tx, ADMIN)((s) => s.renameTeam(id, "  新  "));

      expect(await teamName(tx, id)).toBe("新");
    }));

  it("他社のチームは見つからず、名前は変わらない", () =>
    withRollback(async (tx) => {
      const id = await seedTeam(tx, "cmp_b", "他社");

      const result = await runAs(tx, ADMIN)((s) => s.renameTeam(id, "新"));

      expect(failureTag(result)).toBe("TeamNotFound");
      expect(await teamName(tx, id)).toBe("他社");
    }));

  it("MEMBER は変えられない", () =>
    withRollback(async (tx) => {
      const id = await seedTeam(tx, "cmp_a", "旧");

      const result = await runAs(tx, MEMBER)((s) => s.renameTeam(id, "新"));

      expect(failureTag(result)).toBe("NotManager");
      expect(await teamName(tx, id)).toBe("旧");
    }));

  it("空白だけの名前には変えられない", () =>
    withRollback(async (tx) => {
      const id = await seedTeam(tx, "cmp_a", "旧");

      const result = await runAs(tx, ADMIN)((s) => s.renameTeam(id, "   "));

      expect(failureTag(result)).toBe("InvalidName");
      expect(await teamName(tx, id)).toBe("旧");
    }));
  it("同じ事業所のほかのチームと同じ名前には変えられない", () =>
    withRollback(async (tx) => {
      await seedTeam(tx, "cmp_a", "開発");
      const id = await seedTeam(tx, "cmp_a", "旧");

      const result = await runAs(tx, ADMIN)((s) => s.renameTeam(id, "開発"));

      expect(failureTag(result)).toBe("DuplicateName");
      expect(await teamName(tx, id)).toBe("旧");
    }));
});

describe("deleteTeam", () => {
  it("チームを消すと、そのスキルと割り当ても消え、ほかのチームは残る", () =>
    withRollback(async (tx) => {
      const id = await seedTeam(tx, "cmp_a", "消す");
      await seedSkill(tx, "cmp_a", id, "a");
      await seedSkill(tx, "cmp_a", id, "b");
      await seedAssignment(tx, "cmp_a", id, "u_1");
      await seedAssignment(tx, "cmp_a", id, "u_2");
      const kept = await seedTeam(tx, "cmp_a", "残す");
      await seedSkill(tx, "cmp_a", kept, "c");
      await seedAssignment(tx, "cmp_a", kept, "u_1");

      const result = await runAs(tx, ADMIN)((s) => s.deleteTeam(id));

      expect(failureTag(result)).toBe("success");
      const remaining = async (teamId: string) => [
        await countRows(tx, teams, eq(teams.id, teamId)),
        await countRows(tx, skills, eq(skills.teamId, teamId)),
        await countRows(
          tx,
          teamAssignments,
          eq(teamAssignments.teamId, teamId),
        ),
      ];
      expect(await remaining(id)).toEqual([0, 0, 0]);
      expect(await remaining(kept)).toEqual([1, 1, 1]);
    }));

  it("他社のチームは見つからず、残る", () =>
    withRollback(async (tx) => {
      const id = await seedTeam(tx, "cmp_b", "他社");

      const result = await runAs(tx, ADMIN)((s) => s.deleteTeam(id));

      expect(failureTag(result)).toBe("TeamNotFound");
      expect(await teamName(tx, id)).toBe("他社");
    }));

  it("MEMBER は消せない", () =>
    withRollback(async (tx) => {
      const id = await seedTeam(tx, "cmp_a", "X");
      const before = await countRows(tx, teams);

      const result = await runAs(tx, MEMBER)((s) => s.deleteTeam(id));

      expect(failureTag(result)).toBe("NotManager");
      expect(await countRows(tx, teams)).toBe(before);
    }));

  it("UUID でない id は DB の失敗ではなく見つからない", () =>
    withRollback(async (tx) => {
      const result = await runAs(tx, ADMIN)((s) => s.deleteTeam("x"));

      expect(failureTag(result)).toBe("TeamNotFound");
    }));
});

describe("addSkill", () => {
  it("管理者は自社のチームにスキルを足せる。名前の前後の空白は除く", () =>
    withRollback(async (tx) => {
      const teamId = await seedTeam(tx, "cmp_a", "X");

      await runAs(tx, ADMIN)((s) => s.addSkill(teamId, "  設計  "));

      const rows = await tx
        .select()
        .from(skills)
        .where(eq(skills.teamId, teamId));
      expect(rows).toMatchObject([{ companyId: "cmp_a", name: "設計" }]);
    }));

  it.each([
    ["他社のチーム", ADMIN, "cmp_b", "設計", "TeamNotFound"],
    ["MEMBER", MEMBER, "cmp_a", "設計", "NotManager"],
    ["空白だけの名前", ADMIN, "cmp_a", "   ", "InvalidName"],
  ])("%s には足せない", (_, actor, companyId, name, tag) =>
    withRollback(async (tx) => {
      const teamId = await seedTeam(tx, companyId, "X");
      const before = await countRows(tx, skills);

      const result = await runAs(tx, actor)((s) => s.addSkill(teamId, name));

      expect(failureTag(result)).toBe(tag);
      expect(await countRows(tx, skills)).toBe(before);
    }),
  );
  it("同じチームに同じ名前のスキルは足せず、別のチームには足せる", () =>
    withRollback(async (tx) => {
      const x = await seedTeam(tx, "cmp_a", "X");
      const y = await seedTeam(tx, "cmp_a", "Y");
      await seedSkill(tx, "cmp_a", x, "設計");
      const admin = runAs(tx, ADMIN);

      const duplicate = await admin((s) => s.addSkill(x, "設計"));
      const otherTeam = await admin((s) => s.addSkill(y, "設計"));

      expect(failureTag(duplicate)).toBe("DuplicateName");
      expect(failureTag(otherTeam)).toBe("success");
      expect(await countRows(tx, skills)).toBe(2);
    }));
});

describe("removeSkill", () => {
  it("管理者はスキルを消せ、同じチームのほかのスキルは残る", () =>
    withRollback(async (tx) => {
      const teamId = await seedTeam(tx, "cmp_a", "X");
      const removed = await seedSkill(tx, "cmp_a", teamId, "a");
      const kept = await seedSkill(tx, "cmp_a", teamId, "b");

      await runAs(tx, ADMIN)((s) => s.removeSkill(removed));

      const rows = await tx
        .select({ id: skills.id })
        .from(skills)
        .where(eq(skills.teamId, teamId));
      expect(rows).toEqual([{ id: kept }]);
    }));

  it.each([
    ["他社のスキル", ADMIN, "cmp_b", "SkillNotFound"],
    ["MEMBER", MEMBER, "cmp_a", "NotManager"],
  ])("%s は消せない", (_, actor, companyId, tag) =>
    withRollback(async (tx) => {
      const teamId = await seedTeam(tx, companyId, "X");
      const skillId = await seedSkill(tx, companyId, teamId, "a");

      const result = await runAs(tx, actor)((s) => s.removeSkill(skillId));

      expect(failureTag(result)).toBe(tag);
      expect(await countRows(tx, skills)).toBe(1);
    }),
  );

  it("UUID でない id は DB の失敗ではなく見つからない", () =>
    withRollback(async (tx) => {
      const result = await runAs(tx, ADMIN)((s) => s.removeSkill("x"));

      expect(failureTag(result)).toBe("SkillNotFound");
    }));
});

describe("assign", () => {
  it("事業所のメンバーをチームに割り当て、同じ割り当ての繰り返しは 1 行のまま", () =>
    withRollback(async (tx) => {
      const teamId = await seedTeam(tx, "cmp_a", "X");
      const admin = runAs(tx, { ...ADMIN, companyMemberIds: ["u_2"] });

      await admin((s) => s.assign(teamId, "u_2"));
      const again = await admin((s) => s.assign(teamId, "u_2"));

      expect(failureTag(again)).toBe("success");
      const rows = await tx.select().from(teamAssignments);
      expect(rows).toMatchObject([
        { teamId, userId: "u_2", companyId: "cmp_a" },
      ]);
    }));

  it.each([
    [
      "事業所の一覧にいない人",
      { ...ADMIN, companyMemberIds: ["u_2"] },
      "cmp_a",
      "NotCompanyMember",
    ],
    [
      "一覧を取れない時",
      { ...ADMIN, companyMemberIds: "listMembersFails" as const },
      "cmp_a",
      "MemberListError",
    ],
    [
      "他社のチーム",
      { ...ADMIN, companyMemberIds: ["u_x"] },
      "cmp_b",
      "TeamNotFound",
    ],
    ["MEMBER", { ...MEMBER, companyMemberIds: ["u_x"] }, "cmp_a", "NotManager"],
  ])("%s は割り当てられない", (_, actor, companyId, tag) =>
    withRollback(async (tx) => {
      const teamId = await seedTeam(tx, companyId, "X");

      const result = await runAs(tx, actor)((s) => s.assign(teamId, "u_x"));

      expect(failureTag(result)).toBe(tag);
      expect(await countRows(tx, teamAssignments)).toBe(0);
    }),
  );
});

describe("unassign", () => {
  it("管理者は割り当てを外せ、同じチームのほかの割り当ては残る", () =>
    withRollback(async (tx) => {
      const teamId = await seedTeam(tx, "cmp_a", "X");
      await seedAssignment(tx, "cmp_a", teamId, "u_1");
      await seedAssignment(tx, "cmp_a", teamId, "u_2");

      await runAs(tx, ADMIN)((s) => s.unassign(teamId, "u_1"));

      const rows = await tx
        .select({ userId: teamAssignments.userId })
        .from(teamAssignments);
      expect(rows).toEqual([{ userId: "u_2" }]);
    }));

  it("割り当てていない人を外しても失敗せず、何も消えない", () =>
    withRollback(async (tx) => {
      const teamId = await seedTeam(tx, "cmp_a", "X");
      await seedAssignment(tx, "cmp_a", teamId, "u_1");

      const result = await runAs(tx, ADMIN)((s) => s.unassign(teamId, "u_x"));

      expect(failureTag(result)).toBe("success");
      expect(await countRows(tx, teamAssignments)).toBe(1);
    }));

  it.each([
    ["他社のチーム", ADMIN, "cmp_b", "TeamNotFound"],
    ["MEMBER", MEMBER, "cmp_a", "NotManager"],
  ])("%s の割り当ては外せない", (_, actor, companyId, tag) =>
    withRollback(async (tx) => {
      const teamId = await seedTeam(tx, companyId, "X");
      await seedAssignment(tx, companyId, teamId, "u_1");

      const result = await runAs(tx, actor)((s) => s.unassign(teamId, "u_1"));

      expect(failureTag(result)).toBe(tag);
      expect(await countRows(tx, teamAssignments)).toBe(1);
    }),
  );
});

describe("事業所をまたぐ参照は DB が拒否する", () => {
  const foreignKeyViolation = (insert: () => Promise<unknown>) =>
    expect(insert()).rejects.toMatchObject({ cause: { code: "23503" } });

  it("他社のチームを指すスキル", () =>
    withRollback(async (tx) => {
      const teamId = await seedTeam(tx, "cmp_a", "X");

      await foreignKeyViolation(() =>
        tx.transaction((sp) =>
          sp.insert(skills).values({ companyId: "cmp_b", teamId, name: "a" }),
        ),
      );
    }));

  it("他社のチームを指す割り当て", () =>
    withRollback(async (tx) => {
      const teamId = await seedTeam(tx, "cmp_a", "X");

      await foreignKeyViolation(() =>
        tx.transaction((sp) =>
          sp
            .insert(teamAssignments)
            .values({ companyId: "cmp_b", teamId, userId: "u_1" }),
        ),
      );
    }));
});
