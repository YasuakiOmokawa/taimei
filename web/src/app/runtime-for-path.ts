export type RuntimeForPath = "FoldkitPublic" | "ReactDashboard";

const isDashboardPath = (pathname: string) =>
  pathname === "/dashboard" || pathname.startsWith("/dashboard/");

export const runtimeForPath = (pathname: string): RuntimeForPath =>
  isDashboardPath(pathname) ? "ReactDashboard" : "FoldkitPublic";
