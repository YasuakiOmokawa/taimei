import { Browser, BrowserContext } from "@playwright/test";
import { db } from "../../db/client";
import { user, verification } from "../../db/schema";
import { eq, desc } from "drizzle-orm";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3001";

export async function signIn(browser: Browser): Promise<BrowserContext> {
  // 1. テストユーザー作成（テストごとにユニークなメールアドレス）
  const testEmail = `e2e-test-${Date.now()}@example.com`;
  await createTestUser(testEmail);

  // 2. Magic Link API を呼んでトークン生成
  const response = await fetch(`${BASE_URL}/api/auth/sign-in/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: testEmail }),
  });

  if (!response.ok) {
    throw new Error(`Magic link request failed: ${response.status}`);
  }

  // 3. verification テーブルからトークン取得
  // Better Auth は identifier=token, value=JSON(email) の形式で保存
  const expectedValue = JSON.stringify({ email: testEmail });
  const verificationRecord = await db
    .select()
    .from(verification)
    .where(eq(verification.value, expectedValue))
    .orderBy(desc(verification.createdAt))
    .limit(1)
    .then((rows) => rows[0]);

  if (!verificationRecord) {
    throw new Error(`Verification token not found for ${testEmail}`);
  }

  const token = verificationRecord.identifier;

  // 4. fetch で verify エンドポイントを呼び、Set-Cookie を取得
  const verifyUrl = `${BASE_URL}/api/auth/magic-link/verify?token=${token}&callbackURL=/dashboard`;
  const verifyResponse = await fetch(verifyUrl, { redirect: "manual" });

  const setCookieHeader = verifyResponse.headers.get("set-cookie");
  if (!setCookieHeader) {
    throw new Error("No Set-Cookie header in verify response");
  }

  // 5. クッキーをパースしてブラウザコンテキストに設定
  const cookies = parseCookies(setCookieHeader);
  const context = await browser.newContext();
  await context.addCookies(cookies);

  return context;
}

function parseCookies(
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
  // Set-Cookie ヘッダーは複数のクッキーがカンマ区切りで来る可能性がある
  // ただし、クッキー値内にカンマが含まれることもあるため、正規表現でパース
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

async function createTestUser(email: string) {
  await db.insert(user).values({
    id: `test-user-${Date.now()}`,
    name: "E2E Test User",
    email,
    emailVerified: false,
  });
}
