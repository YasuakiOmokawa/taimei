import { Browser, BrowserContext } from "@playwright/test";
import { db } from "../../db/client";
import { user, session } from "../../db/schema";
import { eq } from "drizzle-orm";

const TEST_USER_ID = "test-user-e2e";
const TEST_SESSION_TOKEN = "test-session-token-e2e";

export async function signIn(browser: Browser): Promise<BrowserContext> {
  await setTestUser();
  await setTestSession();

  const context = await browser.newContext();
  context.addCookies([
    {
      name: "better-auth.session_token",
      value: TEST_SESSION_TOKEN,
      domain: process.env.APPDOMAIN,
      path: "/",
    },
  ]);

  return context;
}

async function setTestUser() {
  const existingUsers = await db
    .select()
    .from(user)
    .where(eq(user.id, TEST_USER_ID));

  if (existingUsers.length === 0) {
    await db.insert(user).values({
      id: TEST_USER_ID,
      name: "Test Example",
      email: "user@example.com",
      image: "https://avatars.githubusercontent.com/u/000000",
      emailVerified: false,
    });
  }
}

async function setTestSession() {
  const existingSessions = await db
    .select()
    .from(session)
    .where(eq(session.token, TEST_SESSION_TOKEN));

  if (existingSessions.length === 0) {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7日後

    await db.insert(session).values({
      id: "test-session-id-e2e",
      token: TEST_SESSION_TOKEN,
      userId: TEST_USER_ID,
      expiresAt,
      ipAddress: "127.0.0.1",
      userAgent: "Playwright E2E Test",
    });
  }
}
