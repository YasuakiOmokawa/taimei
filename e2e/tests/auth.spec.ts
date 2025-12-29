import { test, expect } from "@playwright/test";
import {
  createTestUser,
  getVerificationToken,
  signInWithMagicLink,
} from "./utils/signIn";

test.describe("認証フロー", () => {
  test.describe("保護ルートへの未認証アクセス", () => {
    test("未認証で保護ルートにアクセスすると /login?callbackUrl にリダイレクトされる", async ({
      page,
    }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login\?callbackUrl=.*dashboard/);
    });

    test("ログイン後、callbackUrl にリダイレクトされる", async ({ page }) => {
      // 1. テストユーザーを作成
      const testEmail = await createTestUser();

      // 2. 未認証で /dashboard にアクセス → /login にリダイレクト
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/login\?callbackUrl=.*dashboard/);

      // 3. Magic Link でログイン
      await page
        .getByLabel("Email")
        .fill(testEmail);
      await page.getByRole("button", { name: "ログイン", exact: true }).click();

      // Magic Link 送信成功の toast を待つ（Server Action 完了を確認）
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "メールを送信しました。" })
      ).toBeVisible({ timeout: 10000 });

      // verification テーブルからトークンを取得
      const token = await getVerificationToken(testEmail);

      // トークンを使って認証
      await page.goto(
        `/api/auth/magic-link/verify?token=${token}&callbackURL=/dashboard`
      );

      // /dashboard にリダイレクトされること
      await expect(page).toHaveURL(/\/dashboard/);
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
