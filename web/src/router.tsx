import {
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
} from "@tanstack/react-router";
import LandingPage from "@/landing/landing-page";
import PrivacyPage from "@/privacy/privacy-page";

const rootRoute = createRootRoute();

const routeTree = rootRoute.addChildren([
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: LandingPage,
  }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: "/privacy",
    component: PrivacyPage,
  }),
]);

export const createAppRouter = (
  options: { history?: RouterHistory; origin?: string } = {},
) => createRouter({ routeTree, ...options });

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
