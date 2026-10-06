import "server-only";
import { Effect } from "effect";
import { reportUnexpectedFailure } from "@/app/lib/report-failure";
import { runScopedService } from "@/app/services";
import type { AuthorizationContext } from "@/app/services/authorization-context";
import type { CompanyContext } from "@/app/services/company-context";
import type { TeamFailure } from "@/app/services/team-errors";
import { TeamService } from "@/app/services/team-service";

export const runTeamService = <A>(
  use: (
    service: TeamService["Service"],
  ) => Effect.Effect<A, TeamFailure, CompanyContext | AuthorizationContext>,
) =>
  runScopedService(() =>
    TeamService.use(use).pipe(
      Effect.tapError((failure) =>
        Effect.sync(() => reportUnexpectedFailure(failure)),
      ),
    ),
  );
