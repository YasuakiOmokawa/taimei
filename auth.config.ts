import type { NextAuthConfig } from "next-auth";
import { buildNextAuthResponse } from "./lib/auth/buildNextAuthResponse";
import type { JWT, JWTEncodeParams, JWTDecodeParams } from "next-auth/jwt";

const jwtTestEnv = {
  async encode(_params: JWTEncodeParams<JWT>): Promise<string> {
    return "dummy";
  },
  async decode(_params: JWTDecodeParams): Promise<JWT | null> {
    return {
      id: "test123456",
      name: "Test Example",
      email: "user@example.com",
      image: "https://avatars.githubusercontent.com/u/000000",
      sub: "dummy",
    };
  },
};

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  ...(process.env.APP_ENV === "test" ? { jwt: jwtTestEnv } : {}),
  providers: [],
  callbacks: {
    // NOTE: ミドルウェア経由で動かしたいのでここに書いてる
    authorized({ auth, request: { nextUrl } }) {
      return buildNextAuthResponse(auth, nextUrl);
    },
  },
} satisfies NextAuthConfig;
