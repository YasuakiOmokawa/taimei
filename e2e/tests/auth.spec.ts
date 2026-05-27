import { expect, test } from "@playwright/test";
import {
  AUTH_BASE_URL,
  createTestUser,
  getVerificationToken,
  signInWithMagicLink,
  verifyMagicLinkAndGetContext,
} from "./utils/signIn";

// taimei-auth (認証サーバー) 経由ログインを検証する e2e。
// taimei への未認証アクセス → proxy が AUTH_BASE_URL/auth/?service_name=taimei&redirect_url=... に redirect。
// taimei-auth の SignIn 画面でフォーム送信 → Magic Link verify → taimei /auth/after-signin → /dashboard。
test.describe("認証フロー", () => {
  test.describe("保護ルートへの未認証アクセス", () => {
    test("未認証で保護ルートにアクセスすると taimei-auth にリダイレクトされる", async ({
      page,
    }) => {
      await page.goto("/dashboard");
      // proxy.ts が buildAuthLoginUrl で組んだ URL に redirect する想定
      await expect(page).toHaveURL(
        new RegExp(
          `${AUTH_BASE_URL.replace(/\./g, "\\.")}/auth/\\?service_name=taimei&redirect_url=.*dashboard`,
        ),
      );
    });

    test("ログイン後、redirect_url にリダイレクトされる", async ({
      page,
      browser,
    }) => {
      const testEmail = await createTestUser();
      await page.goto("/dashboard");
      const context = await signInWithMagicLink(browser, testEmail);
      const authedPage = await context.newPage();
      await authedPage.goto("/dashboard");
      await expect(authedPage).toHaveURL(/\/dashboard/);

      await context.close();
    });
  });

  test.describe("ルートページの表示", () => {
    test("未認証で / にアクセスするとランディングページが表示される", async ({
      page,
    }) => {
      await page.goto("/");
      await expect(page).toHaveURL("/");
    });

    test("認証済みで / にアクセスしてもランディングページが表示される", async ({
      browser,
    }) => {
      const testEmail = await createTestUser();
      const context = await signInWithMagicLink(browser, testEmail);
      const page = await context.newPage();

      await page.goto("/");
      await expect(page).toHaveURL("/");

      await context.close();
    });
  });

  test.describe("taimei-auth 経由の統合認証フロー", () => {
    test("未登録メールで認証すると新規アカウントが作成される", async ({
      page,
      browser,
    }) => {
      const newEmail = `new-${Date.now()}@example.com`;

      // taimei-auth の SignIn 画面を直接訪問 (service_name=taimei + redirect_url=...)
      const params = new URLSearchParams({
        service_name: "taimei",
        redirect_url: "http://app.taimei-code.local:3001/auth/after-signin",
      });
      await page.goto(`${AUTH_BASE_URL}/auth/?${params.toString()}`);
      await page.getByLabel("メールアドレス").fill(newEmail);
      await page.getByRole("button", { name: "Magic Link を送信" }).click();

      // Magic Link 送信完了 (画面に「メールを送信しました」表示)
      await expect(page.getByText(newEmail)).toBeVisible();

      const token = await getVerificationToken(newEmail);
      const context = await verifyMagicLinkAndGetContext(browser, token);
      const authedPage = await context.newPage();
      await authedPage.goto("/dashboard");

      // 新規ユーザーは事業所未所属のため、dashboard ではなく事業所登録画面へ redirect される
      // (ADR-0002 の company 必須フロー)。アカウント自体は作成済み。
      await expect(authedPage).toHaveURL(/\/auth\/signup\/company/);

      await context.close();
    });

    test("既存メールで認証するとログインできる", async ({ page, browser }) => {
      const existingEmail = await createTestUser();

      const params = new URLSearchParams({
        service_name: "taimei",
        redirect_url: "http://app.taimei-code.local:3001/auth/after-signin",
      });
      await page.goto(`${AUTH_BASE_URL}/auth/?${params.toString()}`);
      await page.getByLabel("メールアドレス").fill(existingEmail);
      await page.getByRole("button", { name: "Magic Link を送信" }).click();

      await expect(page.getByText(existingEmail)).toBeVisible();

      const token = await getVerificationToken(existingEmail);
      const context = await verifyMagicLinkAndGetContext(browser, token);
      const authedPage = await context.newPage();
      await authedPage.goto("/dashboard");

      await expect(authedPage).toHaveURL(/\/dashboard/);
      await expect(authedPage.locator("h1")).toContainText("Dashboard");

      await context.close();
    });

    test("認証済みユーザーが /dashboard を直接訪問できる (proxy で redirect されない)", async ({
      browser,
    }) => {
      const testEmail = await createTestUser();
      const context = await signInWithMagicLink(browser, testEmail);
      const page = await context.newPage();

      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/dashboard/);

      await context.close();
    });

    test("taimei-auth のエラー画面 (signin_failed) が表示される", async ({
      page,
    }) => {
      await page.goto(`${AUTH_BASE_URL}/auth/error?reason=signin_failed`);
      await expect(page.getByText("ログインに失敗しました")).toBeVisible();
    });
  });
});
