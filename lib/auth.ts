import { betterAuth } from "better-auth";
import { createAuthMiddleware, getOAuthState } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { Effect, Either } from "effect";
import { render } from "@react-email/components";
import { db } from "@/db/drizzle/client";
import * as schema from "@/db/drizzle/schema";
import { handleUserCreateBefore } from "./auth/hooks/user-create-hook";
import {
  isJustSignedUp,
  getAuthSuccessMessage,
} from "./auth/hooks/session-flash-hook";
import { sendWelcomeEmail } from "./email/send-welcome";
import { setFlash } from "@/lib/flash-toaster";
import {
  getResendClient,
  getFromEmail,
  getAppName,
  isTestEnvironment,
} from "./email/client";
import MagicLinkEmail from "./email/magic-link";
import {
  AuthErrorCode,
  AUTH_ERROR_MESSAGES,
} from "./auth/messages/auth-messages";

export const auth = betterAuth({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,

  advanced: {
    // テスト環境（HTTP）では __Secure- プレフィックスを無効化
    // 本番環境（HTTPS）では Better Auth のデフォルト動作を使用
    useSecureCookies: !isTestEnvironment(),
  },

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
    },
  }),

  emailAndPassword: {
    enabled: false,
  },

  socialProviders: {
    github: {
      clientId: process.env.AUTH_GITHUB_ID!,
      clientSecret: process.env.AUTH_GITHUB_SECRET!,
    },
  },

  plugins: [
    nextCookies(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // E2E テスト環境ではメール送信をスキップ（DBから直接トークン取得）
        if (isTestEnvironment()) {
          console.log(`[TEST] Magic Link for ${email}: ${url}`);
          return;
        }

        const resend = getResendClient();
        const fromEmail = getFromEmail();
        const appName = getAppName();

        const emailComponent = MagicLinkEmail({ url, appName });
        const html = await render(emailComponent);
        const text = await render(emailComponent, { plainText: true });

        const { error } = await resend.emails.send({
          from: fromEmail,
          to: email,
          subject: `${appName} へのログインリンク`,
          html,
          text,
        });

        if (error) {
          console.error("Failed to send magic link email:", error);
          throw new Error(`Email sending failed: ${error.message}`);
        }
      },
      expiresIn: 300, // 5分
      // テスト環境ではレートリミットを実質無制限に（E2Eテストのリトライで429を回避）
      rateLimit: isTestEnvironment() ? { window: 1, max: 1000 } : undefined,
    }),
  ],

  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5分間 Cookie にキャッシュ（DB クエリ削減）
    },
  },

  // アカウントリンクは無効（明示的にログイン後に連携させる）
  account: {
    accountLinking: {
      enabled: false,
    },
  },

  databaseHooks: {
    user: {
      create: {
        before: async (user, ctx) =>
          handleUserCreateBefore(user, ctx, getOAuthState),
      },
    },
  },

  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession;
      if (newSession) {
        const createdAt = new Date(newSession.user.createdAt);

        // signup 画面から OAuth で既存ユーザーがログインした場合、
        // セッションを無効化してログインを拒否する
        const oauthState = await getOAuthState();
        const isSignupFlowExistingUser =
          oauthState?.callbackURL?.includes("error=user_already_exists") &&
          !isJustSignedUp(createdAt);

        if (isSignupFlowExistingUser) {
          // 循環依存回避のため動的インポート
          const { AuthService, runService } = await import("@/app/services");

          const result = await runService(() =>
            Effect.gen(function* () {
              const service = yield* AuthService;
              return yield* service.findAccountByUserId(newSession.user.id);
            })
          );

          // GitHub登録済み → user_already_exists
          // Magic Link登録済み（GitHub未連携） → account_not_linked
          const userAccount = Either.isRight(result) ? result.right : null;
          const isGitHubAccount = userAccount?.providerId === "github";
          const message = isGitHubAccount
            ? AUTH_ERROR_MESSAGES[AuthErrorCode.USER_ALREADY_EXISTS]
            : AUTH_ERROR_MESSAGES[AuthErrorCode.ACCOUNT_NOT_LINKED];

          await setFlash({ type: "error", message });

          // Better Auth の signOut API でセッション無効化（Cookie も正しく削除される）
          // createAuthMiddleware 内では ctx.request は常に存在するが、型安全性のためガード
          if (!ctx.request) {
            console.error("ctx.request is unexpectedly null in auth middleware");
          } else {
            await auth.api.signOut({ headers: ctx.request.headers });
          }

          return new Response(null, {
            status: 302,
            headers: { Location: "/login" },
          });
        }

        const flash = getAuthSuccessMessage(createdAt);
        await setFlash(flash);

        // 新規ユーザーにウェルカムメール送信（失敗してもセッション作成には影響させない）
        if (isJustSignedUp(createdAt)) {
          sendWelcomeEmail(newSession.user.email, newSession.user.name).catch(
            (e) => console.error("Welcome email failed:", e)
          );
        }
      }
    }),
  },
});

export type Session = typeof auth.$Infer.Session;
