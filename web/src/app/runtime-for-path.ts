export type RuntimeForPath = "FoldkitPublic" | "FoldkitDashboard";

const isDashboardPath = (pathname: string) =>
  pathname === "/dashboard" || pathname.startsWith("/dashboard/");

export const runtimeForPath = (pathname: string): RuntimeForPath =>
  isDashboardPath(pathname) ? "FoldkitDashboard" : "FoldkitPublic";
