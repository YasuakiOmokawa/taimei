import { and, inArray, lte, sql } from "drizzle-orm";
import { Match, Result } from "effect";
import { CompanyId } from "@/db/company-id";
import { teamAssignments, teams } from "@/db/drizzle/schema";
import { companyFilter, withCompanyScope } from "@/db/scoped";
import {
  type CompanyTeamList,
  writeTeamList,
} from "@/src/services/company-team-list";
import type { Db } from "@/src/services/db-service";
import type { CheckMemberships } from "./membership-answer";
import { reportError } from "./report-error";

export type PurgeReport = {
  deletedCompanyIds: string[];
  removedAssignments: number;
  skippedCompanyIds: string[];
};

export const purgeDeparted = async ({
  db,
  checkMemberships,
  teamListOf,
  startedAt,
}: {
  db: Db["Service"];
  checkMemberships: CheckMemberships;
  teamListOf: (companyId: CompanyId) => CompanyTeamList["Service"];
  startedAt: Date;
}): Promise<PurgeReport> => {
  const report: PurgeReport = {
    deletedCompanyIds: [],
    removedAssignments: 0,
    skippedCompanyIds: [],
  };

  const purgeCompany = async (companyId: CompanyId) => {
    const userIds = await withCompanyScope(db, companyId, async (tx) =>
      (
        await tx
          .selectDistinct({ userId: teamAssignments.userId })
          .from(teamAssignments)
          .where(companyFilter(teamAssignments, companyId))
      ).map((row) => row.userId),
    );
    const answer = await checkMemberships({ companyId, userIds });
    await Match.valueTags(answer, {
      Unknown: async ({ cause }) => {
        reportError(
          new Error(`checkMemberships failed: ${companyId}`, { cause }),
        );
        report.skippedCompanyIds.push(companyId);
      },
      Deleted: async () => {
        Result.getOrThrow(
          await writeTeamList(db, companyId, teamListOf, async (tx) =>
            Result.succeed(
              await tx.delete(teams).where(companyFilter(teams, companyId)),
            ),
          ),
        );
        report.deletedCompanyIds.push(companyId);
      },
      Active: async ({ memberUserIds }) => {
        const members = new Set(memberUserIds);
        const departed = userIds.filter((userId) => !members.has(userId));
        if (departed.length === 0) return;
        const removed = Result.getOrThrow(
          await writeTeamList(db, companyId, teamListOf, async (tx) =>
            Result.succeed(
              await tx
                .delete(teamAssignments)
                .where(
                  and(
                    companyFilter(teamAssignments, companyId),
                    inArray(teamAssignments.userId, departed),
                    lte(teamAssignments.createdAt, startedAt),
                  ),
                )
                .returning({ userId: teamAssignments.userId }),
            ),
          ),
        );
        report.removedAssignments += removed.length;
      },
    });
  };

  const purgeCompanyOfRow = async (companyId: string) =>
    purgeCompany(CompanyId.make(companyId));
  const { rows } = await db.execute<{ company_id: string }>(
    sql`select company_id from company_ids_with_teams() as company_id`,
  );
  // ponytail: Service Binding は 1 起動 32 回までで、チームを持つ事業所が約 31 を超えると後ろの事業所を毎回飛ばす。超えたら taimei-auth に複数の事業所を 1 回で照合する RPC を足す
  for (const { company_id: companyId } of rows) {
    await purgeCompanyOfRow(companyId).catch((cause: unknown) => {
      reportError(new Error(`purgeDeparted failed: ${companyId}`, { cause }));
      report.skippedCompanyIds.push(companyId);
    });
  }
  return report;
};
