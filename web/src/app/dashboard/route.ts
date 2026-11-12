import { pipe, Schema } from "effect";
import { Route } from "foldkit";
import { defineRouteUnion, literal, slash, string } from "foldkit/route";

export const DashboardRoute = defineRouteUnion({
  Home: {},
  Teams: {},
  Team: { teamId: Schema.String },
  Members: {},
  NotFound: { path: Schema.String },
});
export type DashboardRoute = typeof DashboardRoute.Type;

const dashboard = literal("dashboard");
const teams = pipe(dashboard, slash(literal("teams")));

export const homeRouter = pipe(dashboard, Route.mapTo(DashboardRoute.Home));

export const teamsRouter = pipe(teams, Route.mapTo(DashboardRoute.Teams));

export const teamRouter = pipe(
  teams,
  slash(string("teamId")),
  Route.mapTo(DashboardRoute.Team),
);

export const membersRouter = pipe(
  dashboard,
  slash(literal("members")),
  Route.mapTo(DashboardRoute.Members),
);

export const urlToDashboardRoute = Route.parseUrlWithFallback(
  Route.oneOf(teamRouter, teamsRouter, membersRouter, homeRouter),
  DashboardRoute.NotFound,
);
