import { Browser, BrowserContext } from "@playwright/test";
import { db } from "../../db/client";
import { user, verification } from "../../db/schema";
import { eq, desc } from "drizzle-orm";

export const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3001";

export async function createTestUser(): Promise<string> {
  const uuid = crypto.randomUUID();
  await db.insert(user).values({
    id: uuid,
    name: "E2E Test User",
    email: `e2e-${uuid}@example.com`,
    emailVerified: false,
  });
  return `e2e-${uuid}@example.com`;
}

/**
 * Server Action の非同期処理完了を待つため、トークンが見つかるまでポーリング
 * デフォルト: 20回 × 1秒間隔 = 最大20秒
 */
export async function getVerificationToken(
  email: string,
  options: { maxRetries?: number; retryDelay?: number } = {}
): Promise<string> {
  const { maxRetries = 20, retryDelay = 1000 } = options;
  const expectedValue = JSON.stringify({ email });

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const record = await db
      .select()
      .from(verification)
      .where(eq(verification.value, expectedValue))
      .orderBy(desc(verification.createdAt))
      .limit(1)
      .then((rows) => rows[0]);

    if (record) {
      return record.identifier;
    }

    if (attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error(
    `Verification token not found for ${email} after ${maxRetries} attempts`
  );
}

export async function signInWithMagicLink(
  browser: Browser,
  email: string
): Promise<BrowserContext> {
  const response = await fetch(`${BASE_URL}/api/auth/sign-in/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error(`Magic link request failed: ${response.status}`);
  }

  const token = await getVerificationToken(email);

  // Playwright の page.goto() ではなく fetch を使用（Set-Cookie ヘッダーを直接取得するため）
  const verifyUrl = `${BASE_URL}/api/auth/magic-link/verify?token=${token}&callbackURL=/dashboard`;
  const verifyResponse = await fetch(verifyUrl, { redirect: "manual" });

  const setCookieHeader = verifyResponse.headers.get("set-cookie");
  if (!setCookieHeader) {
    throw new Error("No Set-Cookie header in verify response");
  }

  const cookies = parseCookies(setCookieHeader);
  const context = await browser.newContext();
  await context.addCookies(cookies);

  return context;
}

export async function signIn(browser: Browser): Promise<BrowserContext> {
  const email = await createTestUser();
  return signInWithMagicLink(browser, email);
}

export function parseCookies(
  setCookieHeader: string
): Array<{
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}> {
  // カンマ区切りだがクッキー値内にもカンマが含まれうるため、名前=値パターンの前でのみ分割
  const cookieStrings = setCookieHeader.split(/,(?=\s*[a-zA-Z_][a-zA-Z0-9_-]*=)/);
  const domain = new URL(BASE_URL).hostname;

  return cookieStrings.map((cookieStr) => {
    const parts = cookieStr.split(";").map((p) => p.trim());
    const [nameValue, ...attributes] = parts;
    const [name, ...valueParts] = nameValue.split("=");
    const value = decodeURIComponent(valueParts.join("="));

    const cookie: {
      name: string;
      value: string;
      domain: string;
      path: string;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: "Strict" | "Lax" | "None";
    } = {
      name: name.trim(),
      value,
      domain,
      path: "/",
    };

    for (const attr of attributes) {
      const lowerAttr = attr.toLowerCase();
      if (lowerAttr === "httponly") {
        cookie.httpOnly = true;
      } else if (lowerAttr === "secure") {
        cookie.secure = true;
      } else if (lowerAttr.startsWith("path=")) {
        cookie.path = attr.split("=")[1];
      } else if (lowerAttr.startsWith("samesite=")) {
        const sameSiteValue = attr.split("=")[1];
        if (sameSiteValue === "Strict" || sameSiteValue === "Lax" || sameSiteValue === "None") {
          cookie.sameSite = sameSiteValue;
        }
      }
    }

    return cookie;
  });
}
