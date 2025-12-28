import { betterAuth } from "better-auth";
import { getOAuthState } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/db/drizzle/client";
import * as schema from "@/db/drizzle/schema";

export const auth = betterAuth({

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
        before: async (user, ctx) => {
          // ログイン画面からの OAuth で未登録ユーザーが来た場合、自動登録させず新規登録を促す
          const state = await getOAuthState();
          if (state?.mode === "login") {
            if (!ctx) {
              throw new Error("Cannot create user in login mode: context not available");
            }
            // maxAge: 1 で即時削除。リダイレクト先の FlashToaster が読み取り後に破棄される
            ctx.setCookie(
              "flash",
              JSON.stringify({
                type: "error",
                message: "アカウントが存在しません。新規登録してください。",
              }),
              { maxAge: 1 }
            );
            throw ctx.redirect("/signup");
          }
          return { data: user };
        },
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
