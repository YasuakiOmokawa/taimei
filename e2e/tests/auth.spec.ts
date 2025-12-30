import { test, expect } from "@playwright/test";
import {
  createTestUser,
  getVerificationToken,
  signInWithMagicLink,
  BASE_URL,
} from "./utils/signIn";

test.describe("認証フロー", () => {
  test.describe("保護ルートへの未認証アクセス", () => {
    test("未認証で保護ルートにアクセスすると /login?callbackUrl にリダイレクトされる", async ({
      page,
    }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login\?callbackUrl=.*dashboard/);
    });

    test("ログイン後、callbackUrl にリダイレクトされる", async ({
      page,
      browser,
    }) => {
      const testEmail = await createTestUser();
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login\?callbackUrl=.*dashboard/);

      // Magic Link でのセッション作成後の挙動を検証
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
      // 認証状態でもルートパスは /login にリダイレクトしない仕様を検証
      const testEmail = await createTestUser();
      const context = await signInWithMagicLink(browser, testEmail);
      const page = await context.newPage();

      await page.goto("/");
      await expect(page).toHaveURL("/");

      await context.close();
    });
  });

  test.describe("Magic Link - UIフォーム経由のログイン", () => {
    test("UIフォームからログインするとトークンが生成される", async ({
      page,
    }) => {
      const testEmail = await createTestUser();

      await page.goto("/login");
      await page.getByLabel("Email").fill(testEmail);
      await page.getByRole("button", { name: "ログイン", exact: true }).click();

      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "認証リンクをメールで送信しました。" })
      ).toBeVisible();

      // Server Action が verification テーブルにトークンを生成すること
      const token = await getVerificationToken(testEmail);
      expect(token).toBeTruthy();

      const verifyUrl = `${BASE_URL}/api/auth/magic-link/verify?token=${token}&callbackURL=/dashboard`;
      const verifyResponse = await fetch(verifyUrl, { redirect: "manual" });
      expect(verifyResponse.status).toBe(302);
    });
  });

  test.describe("Magic Link - ログイン画面での未登録アカウント検出", () => {
    test("未登録メールでログイン試行するとフラッシュメッセージが表示される", async ({
      page,
    }) => {
      const unregisteredEmail = `unregistered-${Date.now()}@example.com`;

      await page.goto("/login");
      await page
        .getByLabel("Email")
        .fill(unregisteredEmail);
      await page.getByRole("button", { name: "ログイン", exact: true }).click();

      // フラッシュメッセージ（toast）が表示されること
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "アカウントが存在しません。" })
      ).toBeVisible();
    });
  });

  test.describe("Magic Link - 新規登録画面での既存アカウント検出", () => {
    test("既存メールで新規登録試行するとフラッシュメッセージが表示される", async ({
      page,
    }) => {
      const existingEmail = await createTestUser();
      await page.goto("/signup");
      await page
        .getByLabel("Email")
        .fill(existingEmail);
      await page.getByRole("button", { name: "登録", exact: true }).click();

      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "アカウントがすでに存在します。" })
      ).toBeVisible();
    });
  });

  test.describe("AuthMessageHandler - クエリパラメータからのフラッシュ表示", () => {
    test("/login?error=user_already_exists でフラッシュメッセージが表示される", async ({
      page,
    }) => {
      await page.goto("/login?error=user_already_exists");

      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "アカウントがすでに存在します。" })
      ).toBeVisible();

      // クエリパラメータが削除されることを検証
      await expect(page).toHaveURL("/login");
    });

    test("/login?error=login_unregistered でフラッシュメッセージが表示される", async ({
      page,
    }) => {
      await page.goto("/login?error=login_unregistered");

      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "アカウントが存在しません。新規登録してください。" })
      ).toBeVisible();

      await expect(page).toHaveURL("/login");
    });
  });

});
