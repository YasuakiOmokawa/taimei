import { test, expect } from "@playwright/test";
import {
  createTestUser,
  getVerificationToken,
  signInWithMagicLink,
  verifyMagicLinkAndGetContext,
} from "./utils/signIn";

test.describe("認証フロー", () => {
  test.describe("保護ルートへの未認証アクセス", () => {
    test("未認証で保護ルートにアクセスすると /auth?callbackUrl にリダイレクトされる", async ({
      page,
    }) => {
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/auth\?callbackUrl=.*dashboard/);
    });

    test("ログイン後、callbackUrl にリダイレクトされる", async ({
      page,
      browser,
    }) => {
      const testEmail = await createTestUser();
      await page.goto("/dashboard");
      await expect(page).toHaveURL(/\/auth\?callbackUrl=.*dashboard/);

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
      // 認証状態でもルートパスは /auth にリダイレクトしない仕様を検証
      const testEmail = await createTestUser();
      const context = await signInWithMagicLink(browser, testEmail);
      const page = await context.newPage();

      await page.goto("/");
      await expect(page).toHaveURL("/");

      await context.close();
    });
  });

  test.describe("統合認証フロー", () => {
    test("未登録メールで認証すると新規アカウントが作成される", async ({
      page,
      browser,
    }) => {
      // Arrange: 未登録メールアドレス
      const newEmail = `new-${Date.now()}@example.com`;

      // Act: フォーム送信 → Magic Link 検証 → dashboard アクセス
      await page.goto("/auth");
      await page.getByLabel("Email").fill(newEmail);
      await page.getByRole("button", { name: "メールで続ける" }).click();

      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "認証リンクをメールで送信しました。" })
      ).toBeVisible();

      const token = await getVerificationToken(newEmail);
      const context = await verifyMagicLinkAndGetContext(browser, token);
      const authedPage = await context.newPage();
      await authedPage.goto("/dashboard");

      // Assert: ダッシュボードが表示される（認証成功）
      await expect(authedPage).toHaveURL(/\/dashboard/);
      await expect(authedPage.locator("h1")).toContainText("Dashboard");

      await context.close();
    });

    test("既存メールで認証するとログインできる", async ({ page, browser }) => {
      // Arrange: 既存ユーザー作成
      const existingEmail = await createTestUser();

      // Act: フォーム送信 → Magic Link 検証 → dashboard アクセス
      await page.goto("/auth");
      await page.getByLabel("Email").fill(existingEmail);
      await page.getByRole("button", { name: "メールで続ける" }).click();

      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "認証リンクをメールで送信しました。" })
      ).toBeVisible();

      const token = await getVerificationToken(existingEmail);
      const context = await verifyMagicLinkAndGetContext(browser, token);
      const authedPage = await context.newPage();
      await authedPage.goto("/dashboard");

      // Assert: ダッシュボードが表示される（認証成功）
      await expect(authedPage).toHaveURL(/\/dashboard/);
      await expect(authedPage.locator("h1")).toContainText("Dashboard");

      await context.close();
    });

    test("認証済みユーザーが /auth にアクセスすると /dashboard にリダイレクトされる", async ({
      browser,
    }) => {
      // Arrange: 認証済みユーザー
      const testEmail = await createTestUser();
      const context = await signInWithMagicLink(browser, testEmail);
      const page = await context.newPage();

      // Act: /auth にアクセス
      await page.goto("/auth");

      // Assert: /dashboard にリダイレクト
      await expect(page).toHaveURL(/\/dashboard/);

      await context.close();
    });

    test("/auth?error=signin_failed でフラッシュメッセージが表示される", async ({
      page,
    }) => {
      // Act: エラーパラメータ付きで /auth にアクセス
      await page.goto("/auth?error=signin_failed");

      // Assert: エラー toast + URL クリーン
      await expect(
        page
          .locator("[data-sonner-toast]")
          .filter({ hasText: "ログインに失敗しました。" })
      ).toBeVisible();
      await expect(page).toHaveURL("/auth");
    });
  });
});
