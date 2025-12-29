import { Browser, BrowserContext } from "@playwright/test";
import { db } from "../../db/client";
import { user, verification } from "../../db/schema";
import { eq, desc } from "drizzle-orm";

export const BASE_URL =
  process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3001";

/**
 * テストユーザーを作成し、メールアドレスを返す
 */
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
 * verification テーブルから Magic Link トークンを取得（リトライ付き）
 * Server Action 完了を待つため、トークンが見つかるまでポーリング
 */
export async function getVerificationToken(
  email: string,
  options: { maxRetries?: number; retryDelay?: number } = {}
): Promise<string> {
  const { maxRetries = 10, retryDelay = 500 } = options;
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

    // 最後の試行でなければ待機してリトライ
    if (attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error(
    `Verification token not found for ${email} after ${maxRetries} attempts`
  );
}

/**
 * 指定メールアドレスで Magic Link 認証を行い、認証済みコンテキストを返す
 */
export async function signInWithMagicLink(
  browser: Browser,
  email: string
): Promise<BrowserContext> {
  // Magic Link API を呼んでトークン生成
  const response = await fetch(`${BASE_URL}/api/auth/sign-in/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new Error(`Magic link request failed: ${response.status}`);
  }

  // verification テーブルからトークン取得
  const token = await getVerificationToken(email);

  // fetch で verify エンドポイントを呼び、Set-Cookie を取得
  const verifyUrl = `${BASE_URL}/api/auth/magic-link/verify?token=${token}&callbackURL=/dashboard`;
  const verifyResponse = await fetch(verifyUrl, { redirect: "manual" });

  const setCookieHeader = verifyResponse.headers.get("set-cookie");
  if (!setCookieHeader) {
    throw new Error("No Set-Cookie header in verify response");
  }

  // クッキーをパースしてブラウザコンテキストに設定
  const cookies = parseCookies(setCookieHeader);
  const context = await browser.newContext();
  await context.addCookies(cookies);

  return context;
}

/**
 * テストユーザーを作成し、Magic Link 認証を行う（既存互換）
 */
export async function signIn(browser: Browser): Promise<BrowserContext> {
  const email = await createTestUser();
  return signInWithMagicLink(browser, email);
}

/**
 * Set-Cookie ヘッダーをパースして Playwright Cookie 形式に変換
 */
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
