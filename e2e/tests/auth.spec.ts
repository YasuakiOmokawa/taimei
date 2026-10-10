import { expect, test } from "@playwright/test";
import {
  AUTH_BASE_URL,
  getVerificationToken,
  verifyMagicLinkAndGetContext,
} from "./utils/signIn";

const authLoginUrl = new RegExp(
  `^${AUTH_BASE_URL.replace(/\./g, "\\.")}/auth/\\?service_name=taimei&`,
);

test("未ログインで /dashboard を開くと、dashboard に戻る taimei-auth のログインへ移る", async ({
  page,
}) => {
  await page.goto("/dashboard");

  await expect(page).toHaveURL(authLoginUrl);
  const redirectUrl = new URL(
    new URL(page.url()).searchParams.get("redirect_url") ?? "",
  );
  expect(redirectUrl.pathname).toBe("/auth/after-signin");
  // SPA は /dashboard を /dashboard/teams へ移してから API の 401 を受ける
  expect(redirectUrl.searchParams.get("callbackUrl")).toMatch(/^\/dashboard/);
});

test("ランディングページのログインから taimei-auth のログインへ移る", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("link", { name: "ログイン" }).first().click();

  await expect(page).toHaveURL(authLoginUrl);
});

test("未登録のメールで認証すると、事業所の登録を経て /dashboard/teams に戻る", async ({
  page,
  browser,
}) => {
  const newEmail = `new-${crypto.randomUUID()}@example.com`;
  await page.goto("/auth");
  await page.getByLabel("メールアドレス").fill(newEmail);
  await page.getByRole("button", { name: "Magic Link を送信" }).click();
  await expect(page.getByText(newEmail)).toBeVisible();

  const context = await verifyMagicLinkAndGetContext(
    browser,
    await getVerificationToken(newEmail),
  );
  const authedPage = await context.newPage();
  await authedPage.goto("/dashboard");

  // 事業所必須フローは ADR-0002
  await expect(authedPage).toHaveURL(/\/auth\/signup\/company/);
  await authedPage.getByLabel("事業所名").fill("E2E 事業所");
  await authedPage.getByRole("button", { name: "事業所を作成" }).click();
  await expect(authedPage).toHaveURL(/\/dashboard\/teams$/);
  await expect(
    authedPage.getByRole("heading", { name: "チーム", exact: true }),
  ).toBeVisible();

  await context.close();
});
