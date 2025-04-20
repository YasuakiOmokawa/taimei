import { test, expect } from "@playwright/test";
import { DashboardPage } from "./pages/dashboard-page";
import { prisma } from "@/prisma";

test.describe("app/dashboard/page.tsx", () => {
  // this is reused by all tests in the file.
  let dashboadPage: DashboardPage;

  test.beforeEach(async ({ browser }) => {
    // テストユーザーのデータを用意
    if (
      (await prisma.user.count({ where: { email: "user@example.com" } })) === 0
    ) {
      await prisma.user.create({
        data: {
          id: "test123456",
          name: "Test Example",
          email: "user@example.com",
          image: "https://avatars.githubusercontent.com/u/000000",
        },
      });
    }

    // ブラウザにセッションのCookieを保存する
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: "authjs.session-token",
        value: "dummy",
        domain: "localhost",
        path: "/",
      },
    ]);

    dashboadPage = new DashboardPage(await context.newPage());
    await dashboadPage.goto();
  });

  test("has heading title", async () => {
    await expect(dashboadPage.getHeadingPageTitle()).toBeVisible();
  });
});
