import * as Sentry from "@sentry/nextjs";
import type { TeamFailure } from "@/app/services/team-errors";

export const reportUnexpectedFailure = (failure: TeamFailure) => {
  switch (failure._tag) {
    case "TeamServiceError":
    case "DbUnavailable":
      Sentry.captureException(failure.cause);
      return;
    case "MemberListError":
      Sentry.captureMessage("listMembers failed", {
        level: "error",
        extra: { reason: failure.cause },
      });
      return;
  }
};
