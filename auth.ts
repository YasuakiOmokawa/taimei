import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import Resend from "next-auth/providers/resend";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/prisma";
import { getAndDeleteCookie } from "@/lib/auth/serverUtils";
import { buildSignInResponse } from "./lib/auth/buildSignInResponse";

const providers = [
  Resend({
    from: "notifications@transactional.ys-polaris.net",
  }),
  GitHub,
  Credentials({}), // 型エラー防止のため
];

if (process.env.NODE_ENV === "test") {
  providers.push(
    Credentials({
      id: "password",
      name: "Password",
      credentials: {
        password: { label: "Password", type: "password" },
      },
      authorize: (credentials) => {
        if (credentials.password === "password") {
          return {
            email: "test@example.com",
            name: "Test Example",
            image: "https://avatars.githubusercontent.com/u/67470890?s=200&v=4",
          };
        } else {
          return null;
        }
      },
    })
  );
}

export const {
  handlers: { GET, POST },
  auth,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,
  debug: true,
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  providers: providers,
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      const dbUser = await prisma.user.findUniqueOrThrow({
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
        where: { id: String(token.id) },
      });

      session.user = {
        ...session.user,
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        image: dbUser.image,
      };

      return session;
    },
    async signIn({ account, profile, email }) {
      if (account?.type === "email" && !email?.verificationRequest) {
        return buildSignInResponse({
          type: "email",
          email: account.providerAccountId ?? "",
        });
      } else {
        return buildSignInResponse({
          type: "oauth",
          authType:
            (await getAndDeleteCookie("mysite_provider_auth_type")) ?? "",
          profileEmail: profile?.email ?? "",
          providerAccountId: account?.providerAccountId ?? "",
          provider: account?.provider ?? "",
        });
      }
    },
  },
});
