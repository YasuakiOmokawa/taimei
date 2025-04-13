import { test } from "@playwright/test";
import { prisma } from "@/prisma";

test("ログイン状態でアクセスすると、ユーザ情報が表示される", async ({
  browser,
}) => {
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

  // ログインしていないとアクセスできないページのテストをする
  const page = await context.newPage();
  await page.goto("/setting/profile");
});
