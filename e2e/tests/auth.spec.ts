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
      // 1. テストユーザーを作成
      const testEmail = await createTestUser();

      // 2. 未認証で /dashboard にアクセス → /login にリダイレクト
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login\?callbackUrl=.*dashboard/);

      // 3. Magic Link でログイン（API直接呼び出しでトークン生成）
      const context = await signInWithMagicLink(browser, testEmail);
      const authedPage = await context.newPage();

      // 4. /dashboard にリダイレクトされること
      await authedPage.goto("/dashboard");
      await expect(authedPage).toHaveURL(/\/dashboard/);

      await context.close();
    });
  });

  test.describe("ルートページの認証リダイレクト", () => {
    test("未認証で / にアクセスするとランディングページが表示される", async ({
      page,
    }) => {
      await page.goto("/");

      // ランディングページが表示されること（/login へのリダイレクトではない）
      await expect(page).toHaveURL("/");
    });

    test("認証済みで / にアクセスすると /dashboard にリダイレクトされる", async ({
      browser,
    }) => {
      // テストユーザーを作成してログイン
      const testEmail = await createTestUser();
      const context = await signInWithMagicLink(browser, testEmail);
      const page = await context.newPage();

      // ルートページにアクセス
      await page.goto("/");

      // /dashboard にリダイレクトされること
      await expect(page).toHaveURL(/\/dashboard/);

      await context.close();
    });
  });

  test.describe("Magic Link - UIフォーム経由のログイン", () => {
    test("UIフォームからログインするとトークンが生成される", async ({
      page,
    }) => {
      // 1. テストユーザーを作成
      const testEmail = await createTestUser();

      // 2. UIフォームからログイン（Server Action経由）
      await page.goto("/login");
      await page.getByLabel("Email").fill(testEmail);
      await page.getByRole("button", { name: "ログイン", exact: true }).click();

      // 3. 成功フラッシュを待つ
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "メールを送信しました。" })
      ).toBeVisible();

      // 4. Server Action が verification テーブルにトークンを生成したことを確認
      const token = await getVerificationToken(testEmail);
      expect(token).toBeTruthy();

      // 5. トークンで認証してダッシュボードにアクセス可能か検証
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
      // 既存ユーザーを作成
      const existingEmail = await createTestUser();
      await page.goto("/signup");
      await page
        .getByLabel("Email")
        .fill(existingEmail);
      await page.getByRole("button", { name: "登録", exact: true }).click();

      // フラッシュメッセージ（toast）が表示されること
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "アカウントがすでに存在します。" })
      ).toBeVisible();
    });
  });

  test.describe("LoginPageFlash - クエリパラメータからのフラッシュ表示", () => {
    test("/login?from=signup でフラッシュメッセージが表示される", async ({
      page,
    }) => {
      await page.goto("/login?from=signup");

      // フラッシュメッセージ（toast）が表示されること
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "アカウントが既に存在します。ログインしてください。" })
      ).toBeVisible();

      // URL からクエリパラメータが削除されること
      await expect(page).toHaveURL("/login");
    });
  });

});
