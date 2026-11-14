import { expect, it } from "vitest";
import { runtimeForPath } from "../runtime-for-path";

it.each([
  "/dashboard",
  "/dashboard/",
  "/dashboard/teams",
  "/dashboard/teams/t_1",
  "/dashboard/no-such-page",
])("%s は application dashboard に渡す", (pathname) => {
  expect(runtimeForPath(pathname)).toBe("FoldkitDashboard");
});

it.each(["/", "/privacy", "/no-such-page", "/dashboardx", "/service/1"])(
  "%s は application public に渡す (知らない path は public の Not Found が受ける)",
  (pathname) => {
    expect(runtimeForPath(pathname)).toBe("FoldkitPublic");
  },
);
