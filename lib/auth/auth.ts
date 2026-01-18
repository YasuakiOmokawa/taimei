import { betterAuth } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { render } from "@react-email/components";
import { db } from "@/db/drizzle/client";
import * as schema from "@/db/drizzle/schema";
import {
  isJustSignedUp,
  getAuthSuccessMessage,
} from "./hooks/session-flash-hook";
import { sendWelcomeEmail } from "@/lib/email/send-welcome";
import { setFlash } from "@/lib/flash-toaster";
import {
  getResendClient,
  getMagicLinkFromEmail,
  getAppName,
  isTestEnvironment,
} from "@/lib/email/client";
import MagicLinkEmail from "@/lib/email/magic-link";

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
        const fromEmail = getMagicLinkFromEmail();
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

  // アカウントリンクを有効化（同一メールアドレスの認証方法を自動連携）
  account: {
    accountLinking: {
      enabled: true,
      // 連携時に GitHub のアバター/名前で既存ユーザー情報を上書きしない
      trustedProviders: [],
    },
  },

  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession;

      if (newSession) {
        const createdAt = new Date(newSession.user.createdAt);

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
