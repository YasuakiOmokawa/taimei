import { and, asc, eq, exists, sql } from "drizzle-orm";
import { Context, Effect, Layer, Predicate, Schema } from "effect";
import {
  memberSkills,
  skills,
  teamAssignments,
  teams,
} from "@/db/drizzle/schema";
import { companyFilter } from "@/db/scoped";
import { AuthorizationContext, isManager } from "./authorization-context";
import { CompanyContext } from "./company-context";
import { CompanyMembers } from "./company-members-service";
import { Db } from "./db-service";
import { LevelFromForm } from "./level";
import {
  DuplicateName,
  InvalidLevel,
  InvalidName,
  NotAssigned,
  NotCompanyMember,
  NotManager,
  SkillNotFound,
  TeamNotFound,
  TeamServiceError,
} from "./team-errors";
import { TeamOrSkillName } from "./team-or-skill-name";

// uuid 列を UUID でない文字列と比べると PostgreSQL が失敗するので、問い合わせる前に見つからない扱いにする
const isUuid = Schema.is(Schema.String.check(Schema.isUUID()));

const decodeTeamOrSkillName = Schema.decodeUnknownEffect(TeamOrSkillName);
const decodeName = (name: string) =>
  decodeTeamOrSkillName(name).pipe(Effect.mapError(() => new InvalidName()));

const decodeLevelFromForm = Schema.decodeUnknownEffect(LevelFromForm);
const decodeLevel = (level: string) =>
  decodeLevelFromForm(level).pipe(Effect.mapError(() => new InvalidLevel()));

// drizzle は pg のエラーを cause に包む
const isUniqueViolation = (error: unknown) =>
  Predicate.hasProperty(error, "cause") &&
  Predicate.hasProperty(error.cause, "code") &&
  error.cause.code === "23505";

export type LevelEntry = {
  readonly skillId: string;
  readonly level: string;
  readonly wantsToLearn: boolean;
};

const requireManager = Effect.gen(function* () {
  const { role } = yield* AuthorizationContext;
  if (!isManager(role)) return yield* new NotManager();
});

export class TeamService extends Context.Service<TeamService>()(
  "services/TeamService",
  {
    make: Effect.gen(function* () {
      const db = yield* Db;
      const companyMembers = yield* CompanyMembers;

      const runQuery = <A>(run: () => Promise<A>) =>
        Effect.tryPromise({
          try: run,
          catch: (cause) => new TeamServiceError({ cause }),
        });

      // 一意制約の違反で外側の transaction を中断しないよう、savepoint の中で書く
      const runNameWrite = <A>(run: (tx: typeof db) => Promise<A>) =>
        Effect.tryPromise({
          try: () => db.transaction(run),
          catch: (cause) =>
            isUniqueViolation(cause)
              ? new DuplicateName()
              : new TeamServiceError({ cause }),
        });

      const visibleTeamCondition = Effect.gen(function* () {
        const { companyId } = yield* CompanyContext;
        const { userId, role } = yield* AuthorizationContext;
        const inCompany = companyFilter(teams, companyId);
        if (isManager(role)) return inCompany;
        return and(
          inCompany,
          exists(
            db
              .select()
              .from(teamAssignments)
              .where(
                and(
                  eq(teamAssignments.teamId, teams.id),
                  eq(teamAssignments.userId, userId),
                  companyFilter(teamAssignments, companyId),
                ),
              ),
          ),
        );
      });

      const findTeam = (teamId: string) =>
        Effect.gen(function* () {
          if (!isUuid(teamId)) return yield* new TeamNotFound({ teamId });
          const visible = yield* visibleTeamCondition;
          const [team] = yield* runQuery(() =>
            db
              .select({ id: teams.id, name: teams.name })
              .from(teams)
              .where(and(eq(teams.id, teamId), visible)),
          );
          if (!team) return yield* new TeamNotFound({ teamId });
          return team;
        });

      return {
        listTeams: () =>
          Effect.gen(function* () {
            const visible = yield* visibleTeamCondition;
            return yield* runQuery(() =>
              db
                .select({ id: teams.id, name: teams.name })
                .from(teams)
                .where(visible)
                .orderBy(asc(teams.createdAt)),
            );
          }),

        getTeam: (teamId: string) =>
          Effect.gen(function* () {
            const team = yield* findTeam(teamId);
            const { companyId } = yield* CompanyContext;
            const [teamSkills, assignments, levels] = yield* Effect.all([
              runQuery(() =>
                db
                  .select({ id: skills.id, name: skills.name })
                  .from(skills)
                  .where(
                    and(
                      eq(skills.teamId, team.id),
                      companyFilter(skills, companyId),
                    ),
                  )
                  .orderBy(asc(skills.createdAt)),
              ),
              runQuery(() =>
                db
                  .select({ userId: teamAssignments.userId })
                  .from(teamAssignments)
                  .where(
                    and(
                      eq(teamAssignments.teamId, team.id),
                      companyFilter(teamAssignments, companyId),
                    ),
                  ),
              ),
              runQuery(() =>
                db
                  .select({
                    userId: memberSkills.userId,
                    skillId: memberSkills.skillId,
                    level: memberSkills.level,
                    wantsToLearn: memberSkills.wantsToLearn,
                  })
                  .from(memberSkills)
                  .where(
                    and(
                      eq(memberSkills.teamId, team.id),
                      companyFilter(memberSkills, companyId),
                    ),
                  ),
              ),
            ]);
            return {
              ...team,
              skills: teamSkills,
              assignedUserIds: assignments.map((a) => a.userId),
              levels,
            };
          }),

        createTeam: (name: string) =>
          Effect.gen(function* () {
            yield* requireManager;
            const validName = yield* decodeName(name);
            const { companyId } = yield* CompanyContext;
            const [team] = yield* runNameWrite((tx) =>
              tx
                .insert(teams)
                .values({ companyId, name: validName })
                .returning({ id: teams.id }),
            );
            return team;
          }),

        renameTeam: (teamId: string, name: string) =>
          Effect.gen(function* () {
            yield* requireManager;
            const validName = yield* decodeName(name);
            if (!isUuid(teamId)) return yield* new TeamNotFound({ teamId });
            const { companyId } = yield* CompanyContext;
            const updated = yield* runNameWrite((tx) =>
              tx
                .update(teams)
                .set({ name: validName })
                .where(
                  and(eq(teams.id, teamId), companyFilter(teams, companyId)),
                )
                .returning({ id: teams.id }),
            );
            if (updated.length === 0)
              return yield* new TeamNotFound({ teamId });
          }),

        deleteTeam: (teamId: string) =>
          Effect.gen(function* () {
            yield* requireManager;
            if (!isUuid(teamId)) return yield* new TeamNotFound({ teamId });
            const { companyId } = yield* CompanyContext;
            const deleted = yield* runQuery(() =>
              db
                .delete(teams)
                .where(
                  and(eq(teams.id, teamId), companyFilter(teams, companyId)),
                )
                .returning({ id: teams.id }),
            );
            if (deleted.length === 0)
              return yield* new TeamNotFound({ teamId });
          }),

        addSkill: (teamId: string, name: string) =>
          Effect.gen(function* () {
            yield* requireManager;
            const validName = yield* decodeName(name);
            const team = yield* findTeam(teamId);
            const { companyId } = yield* CompanyContext;
            yield* runNameWrite((tx) =>
              tx
                .insert(skills)
                .values({ companyId, teamId: team.id, name: validName }),
            );
          }),

        removeSkill: (skillId: string) =>
          Effect.gen(function* () {
            yield* requireManager;
            if (!isUuid(skillId)) return yield* new SkillNotFound({ skillId });
            const { companyId } = yield* CompanyContext;
            const deleted = yield* runQuery(() =>
              db
                .delete(skills)
                .where(
                  and(eq(skills.id, skillId), companyFilter(skills, companyId)),
                )
                .returning({ id: skills.id }),
            );
            if (deleted.length === 0)
              return yield* new SkillNotFound({ skillId });
          }),

        assign: (teamId: string, userId: string) =>
          Effect.gen(function* () {
            yield* requireManager;
            const team = yield* findTeam(teamId);
            // taimei に membership の表は無いので、帰属は taimei-auth の一覧で確かめる (ADR-0002 D2 の外部参照の検証)
            const members = yield* companyMembers.list;
            if (!members.some((member) => member.userId === userId))
              return yield* new NotCompanyMember({ userId });
            const { companyId } = yield* CompanyContext;
            yield* runQuery(() =>
              db
                .insert(teamAssignments)
                .values({ companyId, teamId: team.id, userId })
                .onConflictDoNothing(),
            );
          }),

        saveMyLevels: (teamId: string, entries: readonly LevelEntry[]) =>
          Effect.gen(function* () {
            const team = yield* findTeam(teamId);
            const { userId } = yield* AuthorizationContext;
            const { companyId } = yield* CompanyContext;
            const [[assignment], teamSkills] = yield* Effect.all([
              runQuery(() =>
                db
                  .select({ userId: teamAssignments.userId })
                  .from(teamAssignments)
                  .where(
                    and(
                      eq(teamAssignments.teamId, team.id),
                      eq(teamAssignments.userId, userId),
                      companyFilter(teamAssignments, companyId),
                    ),
                  ),
              ),
              runQuery(() =>
                db
                  .select({ id: skills.id })
                  .from(skills)
                  .where(
                    and(
                      eq(skills.teamId, team.id),
                      companyFilter(skills, companyId),
                    ),
                  ),
              ),
            ]);
            if (!assignment) return yield* new NotAssigned();
            const rows = yield* Effect.forEach(entries, (entry) =>
              decodeLevel(entry.level).pipe(
                Effect.map((level) => ({
                  companyId,
                  teamId: team.id,
                  skillId: entry.skillId,
                  userId,
                  level,
                  wantsToLearn: entry.wantsToLearn,
                })),
              ),
            );
            // 1 つの upsert で同じ行を 2 回更新すると PostgreSQL が文ごと失敗する
            if (new Set(rows.map((row) => row.skillId)).size !== rows.length)
              return yield* new InvalidLevel();
            const teamSkillIds = new Set(teamSkills.map((skill) => skill.id));
            const rowOutsideTeam = rows.find(
              (row) => !teamSkillIds.has(row.skillId),
            );
            if (rowOutsideTeam)
              return yield* new SkillNotFound({
                skillId: rowOutsideTeam.skillId,
              });
            if (rows.length === 0) return;
            yield* runQuery(() =>
              db
                .insert(memberSkills)
                .values(rows)
                .onConflictDoUpdate({
                  target: [memberSkills.skillId, memberSkills.userId],
                  set: {
                    level: sql.raw(`excluded.${memberSkills.level.name}`),
                    wantsToLearn: sql.raw(
                      `excluded.${memberSkills.wantsToLearn.name}`,
                    ),
                    updatedAt: sql`now()`,
                  },
                }),
            );
          }),

        unassign: (teamId: string, userId: string) =>
          Effect.gen(function* () {
            yield* requireManager;
            const team = yield* findTeam(teamId);
            const { companyId } = yield* CompanyContext;
            yield* runQuery(() =>
              db
                .delete(teamAssignments)
                .where(
                  and(
                    eq(teamAssignments.teamId, team.id),
                    eq(teamAssignments.userId, userId),
                    companyFilter(teamAssignments, companyId),
                  ),
                ),
            );
          }),
      };
    }),
  },
) {
  static readonly layer = Layer.effect(this, this.make);
}
