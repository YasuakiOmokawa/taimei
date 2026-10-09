import "server-only";
import type { Effect } from "effect";
import { runManagerScopedService, runScopedService } from "@/app/services";
import type { AuthorizationContext } from "@/app/services/authorization-context";
import type { CompanyContext } from "@/app/services/company-context";
import type { TeamFailure } from "@/app/services/team-errors";
import { TeamManagement, TeamService } from "@/app/services/team-service";

export const runTeamService = <A>(
  use: (
    service: TeamService["Service"],
  ) => Effect.Effect<A, TeamFailure, CompanyContext | AuthorizationContext>,
) => runScopedService(() => TeamService.use(use));

export const runTeamManagement = <A>(
  use: (
    service: TeamManagement["Service"],
  ) => Effect.Effect<A, TeamFailure, CompanyContext>,
) => runManagerScopedService(() => TeamManagement.use(use));
