import { test, expect } from "@playwright/test";
import { DashboardPage } from "./pages/dashboard-page";
import { signIn } from "./utils/signIn";

test.describe("app/dashboard/page.tsx", () => {
  let dashboardPage: DashboardPage;

  test.beforeAll(async ({ browser }) => {
    const browserContext = await signIn(browser);
    dashboardPage = new DashboardPage(await browserContext.newPage());
  });

  test.beforeEach(async () => {
    await dashboardPage.goto();
  });

  test("has heading title", async () => {
    await expect(dashboardPage.getHeadingPageTitle()).toBeVisible();
  });
});
