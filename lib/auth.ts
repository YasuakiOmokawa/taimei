import { betterAuth } from "better-auth";
import { getOAuthState } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db/drizzle/client";
import * as schema from "@/db/drizzle/schema";
import { handleUserCreateBefore } from "./auth/hooks/user-create-hook";

export const auth = betterAuth({
  // E2E テスト等で使用する baseURL（環境変数から取得）
  baseURL: process.env.NEXT_PUBLIC_APP_URL,

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
        // Resend 経由でメール送信（Phase 6 で実装）
        console.log(`Sending magic link to ${email}: ${url}`);
      },
      expiresIn: 300, // 5分
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

  callbacks: {
    session: {
      // セッション作成後のフラッシュメッセージ設定
      // onNewSession で実装する場合は Phase 6 で追加
    },
  },
});

export type Session = typeof auth.$Infer.Session;
