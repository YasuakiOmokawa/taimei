import { betterAuth } from "better-auth";
import { createAuthMiddleware, getOAuthState } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { db } from "@/db/drizzle/client";
import * as schema from "@/db/drizzle/schema";
import { handleUserCreateBefore } from "./auth/hooks/user-create-hook";
import {
  isJustSignedUp,
  getAuthSuccessMessage,
} from "./auth/hooks/session-flash-hook";
import { sendWelcomeEmail } from "./email/send-welcome";
import { setFlash } from "@/lib/flash-toaster";
import { render } from "@react-email/components";
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

        // signup 画面から OAuth で既存ユーザーがログインした場合、
        // セッションを無効化してログインを拒否する
        const oauthState = await getOAuthState();
        const isSignupFlowExistingUser =
          oauthState?.callbackURL?.includes("error=user_already_exists") &&
          !isJustSignedUp(createdAt);

        if (isSignupFlowExistingUser) {
          // セッションを DB から削除
          await db
            .delete(schema.session)
            .where(eq(schema.session.id, newSession.session.id));

          // Cookie キャッシュも削除（cookieCache が有効なため、DB 削除だけでは不十分）
          const cookieStore = await cookies();
          const prefix = isTestEnvironment() ? "" : "__Secure-";
          cookieStore.delete(`${prefix}better-auth.session_token`);
          cookieStore.delete(`${prefix}better-auth.session_data`);

          return; // フラッシュ設定をスキップ（クライアント側でエラー表示）
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
