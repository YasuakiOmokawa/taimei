import { Browser, BrowserContext } from "@playwright/test";
import { prisma } from "@/prisma";

export async function signIn(browser: Browser): Promise<BrowserContext> {
  await setTestUser();
  const context = await browser.newContext();
  context.addCookies([
    {
      name: "authjs.session-token",
      value: "dummy",
      domain: process.env.APPDOMAIN,
      path: "/",
    },
  ]);

  return context;
}

async function setTestUser() {
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
}
