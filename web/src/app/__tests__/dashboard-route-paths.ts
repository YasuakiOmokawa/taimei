import {
  type DashboardRoute,
  homeRouter,
  membersRouter,
  teamRouter,
  teamsRouter,
} from "../dashboard/route";

export const dashboardPathsByRoute = (teamId: string) =>
  ({
    Home: homeRouter(),
    Teams: teamsRouter(),
    Team: teamRouter({ teamId }),
    Members: membersRouter(),
  }) satisfies Record<Exclude<DashboardRoute["_tag"], "NotFound">, string>;
