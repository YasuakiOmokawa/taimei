import { Browser, BrowserContext } from "@playwright/test";
import { desc } from "drizzle-orm";

import { authDb } from "../../db/auth-client";
import { user, verification } from "../../db/auth-schema";

// sign 流 (PR5b/PR7 で taimei に統合) 対応の e2e signIn helper。
// taimei (app.taimei-code.local:3001) と taimei-auth (auth.taimei-code.local:3100) は別オリジン。
// Magic Link 関連の API はすべて taimei-auth (AUTH_BASE_URL) に飛ばし、
// 検証完了後 callbackURL = APP_BASE_URL/auth/after-signin に redirect させる。
//
// Cookie domain は AUTH_COOKIE_DOMAIN=taimei-code.local 設定済 (PR12a)。
// Better Auth が Set-Cookie: Domain=.taimei-code.local で返すため、
// Playwright BrowserContext に追加するときも同じ domain を指定する必要がある。
export const APP_BASE_URL =
  process.env.APP_BASE_URL ?? "http://app.taimei-code.local:3001";
export const AUTH_BASE_URL =
  process.env.AUTH_BASE_URL ?? "http://auth.taimei-code.local:3100";
const COOKIE_DOMAIN = ".taimei-code.local";

export async function createTestUser(): Promise<string> {
  const uuid = crypto.randomUUID();
  await authDb.insert(user).values({
    id: uuid,
    name: "E2E Test User",
    email: `e2e-${uuid}@example.com`,
    emailVerified: false,
  });
  return `e2e-${uuid}@example.com`;
}

// Server Action の非同期処理完了を待つため、トークンが見つかるまでポーリング (最大 20s)。
// Better Auth 1.5.6 の magic-link plugin は verification.value に
//   { email, name?, attempt: number }
// の JSON を保存するため、完全一致でなく email キーで post-filter する。
// (storeToken の default は "plain" のため identifier = raw token と一致。)
export async function getVerificationToken(
  email: string,
  options: { maxRetries?: number; retryDelay?: number } = {},
): Promise<string> {
  const { maxRetries = 20, retryDelay = 1000 } = options;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const records = await authDb
      .select()
      .from(verification)
      .orderBy(desc(verification.createdAt))
      .limit(20);

    const record = records.find((r) => {
      try {
        const parsed = JSON.parse(r.value);
        return parsed.email === email;
      } catch {
        return false;
      }
    });

    if (record) {
      return record.identifier;
    }

    if (attempt < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error(
    `Verification token not found for ${email} after ${maxRetries} attempts`,
  );
}

export async function signInWithMagicLink(
  browser: Browser,
  email: string,
): Promise<BrowserContext> {
  // 1. taimei-auth に Magic Link 送信リクエスト (verification record が DB に書かれる)
  const sendResp = await fetch(`${AUTH_BASE_URL}/api/auth/sign-in/magic-link`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!sendResp.ok) {
    throw new Error(`Magic link request failed: ${sendResp.status}`);
  }

  // 2. DB から token を取得して verify。callbackURL は taimei /auth/after-signin (sign 流着地点)。
  const token = await getVerificationToken(email);
  const verifyUrl = `${AUTH_BASE_URL}/api/auth/magic-link/verify?token=${token}&callbackURL=${encodeURIComponent(`${APP_BASE_URL}/auth/after-signin`)}`;
  const verifyResponse = await fetch(verifyUrl, { redirect: "manual" });

  const setCookieHeader = verifyResponse.headers.get("set-cookie");
  if (!setCookieHeader) {
    throw new Error("No Set-Cookie header in verify response");
  }

  // 3. Set-Cookie を BrowserContext に追加。domain は taimei-code.local (cross-subdomain)。
  const cookies = parseCookies(setCookieHeader);
  const context = await browser.newContext();
  await context.addCookies(cookies);

  return context;
}

export async function signIn(browser: Browser): Promise<BrowserContext> {
  const email = await createTestUser();
  return signInWithMagicLink(browser, email);
}

// 既知 token から直接 verify する (auth.spec.ts でフォーム送信後の token 取得経路で使用)。
export async function verifyMagicLinkAndGetContext(
  browser: Browser,
  token: string,
): Promise<BrowserContext> {
  const verifyUrl = `${AUTH_BASE_URL}/api/auth/magic-link/verify?token=${token}&callbackURL=${encodeURIComponent(`${APP_BASE_URL}/auth/after-signin`)}`;
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

export function parseCookies(setCookieHeader: string): Array<{
  name: string;
  value: string;
  domain: string;
  path: string;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Strict" | "Lax" | "None";
}> {
  const cookieStrings = setCookieHeader.split(/,(?=\s*[a-zA-Z_][a-zA-Z0-9_-]*=)/);

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
      domain: COOKIE_DOMAIN,
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
