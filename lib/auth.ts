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

        // signup 画面経由での「なりすまし登録」を防ぐ
        // 既存ユーザーは login 画面からログインさせ、signup フローを中断する
        const oauthState = await getOAuthState();
        const hasFromSignup = oauthState?.callbackURL?.includes("from=signup");
        const justSignedUp = isJustSignedUp(createdAt);
        const isSignupFlowExistingUser = hasFromSignup && !justSignedUp;

        if (isSignupFlowExistingUser) {
          // auth.ts → services/index.ts の相互参照を避けるため動的インポート
          const { AuthService, runService } = await import("@/app/services");

          const result = await runService(() =>
            Effect.gen(function* () {
              const service = yield* AuthService;
              return yield* service.findAccountByUserId(newSession.user.id);
            })
          );

          // DB エラー時はシステムエラーとして処理（ユーザーに誤った案内を出さない）
          if (Either.isLeft(result)) {
            console.error("[AUTH] Failed to find account:", result.left);
            throw ctx.redirect("/login?error=system_error");
          }

          // エラーメッセージを出し分け：GitHub連携済みなら「既存アカウントあり」、
          // Magic Link のみなら「GitHub連携を促す」メッセージを表示
          const userAccount = result.right;
          const isGitHubAccount = userAccount?.providerId === "github";

          // auth.api.signOut() は別リクエストコンテキストを生成するため、
          // OAuth コールバックのレスポンスに Cookie 削除が反映されない
          const sessionToken = newSession.session.token;
          await ctx.context.internalAdapter.deleteSession(sessionToken);
          const cookieName = ctx.context.authCookies.sessionToken.name;
          ctx.setCookie(cookieName, "", { maxAge: 0, path: "/" });

          // useAuthMessage フックがクエリパラメータからエラーコードを読み取り toast 表示
          const errorCode = isGitHubAccount ? "user_already_exists" : "account_not_linked";
          throw ctx.redirect(`/login?error=${errorCode}`);
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
