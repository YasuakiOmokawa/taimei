import "@fontsource-variable/inter";
import "@fontsource/lusitana/400.css";
import "./index.css";
import { type RuntimeForPath, runtimeForPath } from "./app/runtime-for-path";
import { CRASH_MESSAGE, CRASH_STYLE } from "./shared/crash-view";

const startRuntime: Record<RuntimeForPath, () => Promise<unknown>> = {
  FoldkitPublic: () => import("./app/public/entry"),
  FoldkitDashboard: () => import("./app/dashboard/entry"),
};

const showCrashInEmptyRoot = () => {
  const root = document.getElementById("root");
  if (root === null || root.hasChildNodes()) {
    return;
  }
  const alert = document.createElement("div");
  alert.setAttribute("role", "alert");
  Object.assign(alert.style, CRASH_STYLE);
  alert.textContent = CRASH_MESSAGE;
  root.replaceChildren(alert);
};

void startRuntime[runtimeForPath(window.location.pathname)]().catch(
  (error: unknown) => {
    showCrashInEmptyRoot();
    throw error;
  },
);
