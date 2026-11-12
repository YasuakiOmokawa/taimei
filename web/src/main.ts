import "@fontsource-variable/inter";
import "@fontsource/lusitana/400.css";
import "./index.css";
import { type RuntimeForPath, runtimeForPath } from "./app/runtime-for-path";

const startRuntime: Record<RuntimeForPath, () => Promise<unknown>> = {
  FoldkitPublic: () => import("./app/public/entry"),
  ReactDashboard: () => import("./app/dashboard/entry"),
};

void startRuntime[runtimeForPath(window.location.pathname)]();
