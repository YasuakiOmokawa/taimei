import "server-only";
import { type Effect, Result } from "effect";
import { reportUnexpectedFailure } from "@/app/lib/team-failure";
import { runManagerScopedService, runScopedService } from "@/app/services";
import type { AuthorizationContext } from "@/app/services/authorization-context";
import type { CompanyContext } from "@/app/services/company-context";
import type { TeamFailure } from "@/app/services/team-errors";
import { TeamManagement, TeamService } from "@/app/services/team-service";

const reportingUnexpectedFailure = async <A>(
  pendingResult: Promise<Result.Result<A, TeamFailure>>,
) => {
  const result = await pendingResult;
  if (Result.isFailure(result)) reportUnexpectedFailure(result.failure);
  return result;
};

export const runTeamService = <A>(
  use: (
    service: TeamService["Service"],
  ) => Effect.Effect<A, TeamFailure, CompanyContext | AuthorizationContext>,
) => reportingUnexpectedFailure(runScopedService(() => TeamService.use(use)));

export const runTeamManagement = <A>(
  use: (
    service: TeamManagement["Service"],
  ) => Effect.Effect<A, TeamFailure, CompanyContext>,
) =>
  reportingUnexpectedFailure(
    runManagerScopedService(() => TeamManagement.use(use)),
  );
