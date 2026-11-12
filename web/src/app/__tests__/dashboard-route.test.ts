import { Option } from "effect";
import { fromString } from "foldkit/url";
import { describe, expect, it } from "vitest";
import {
  DashboardRoute,
  homeRouter,
  membersRouter,
  teamRouter,
  teamsRouter,
  urlToDashboardRoute,
} from "../dashboard/route";

const TEAM_ID = "11111111-1111-4111-8111-111111111111";

const routeOf = (pathname: string) =>
  urlToDashboardRoute(
    Option.getOrThrowWith(
      fromString(`https://app.example.com${pathname}`),
      () => new Error(`URL として読めない: ${pathname}`),
    ),
  );

describe("application dashboard の route", () => {
  it.each([
    ["/dashboard", DashboardRoute.Home()],
    ["/dashboard/", DashboardRoute.Home()],
    ["/dashboard/teams", DashboardRoute.Teams()],
    ["/dashboard/teams/", DashboardRoute.Teams()],
    [`/dashboard/teams/${TEAM_ID}`, DashboardRoute.Team({ teamId: TEAM_ID })],
    ["/dashboard/members", DashboardRoute.Members()],
  ])("%s は dashboard の route になる", (pathname, route) => {
    expect(routeOf(pathname)).toEqual(route);
  });

  it.each([
    "/dashboard/no-such-page",
    `/dashboard/teams/${TEAM_ID}/skills`,
    "/dashboardx",
    "/privacy",
    "/",
  ])("%s は dashboard の route にならない", (pathname) => {
    expect(routeOf(pathname)).toEqual(
      DashboardRoute.NotFound({ path: pathname }),
    );
  });

  it("route から作った path は、同じ route に読み戻せる", () => {
    expect(
      [
        homeRouter(),
        teamsRouter(),
        teamRouter({ teamId: TEAM_ID }),
        membersRouter(),
      ].map(routeOf),
    ).toEqual([
      DashboardRoute.Home(),
      DashboardRoute.Teams(),
      DashboardRoute.Team({ teamId: TEAM_ID }),
      DashboardRoute.Members(),
    ]);
  });
});
