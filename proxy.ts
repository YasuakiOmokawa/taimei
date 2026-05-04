import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { buildAuthLoginUrl } from "@taimei-code/auth-client";

// sign 流: 未認証なら taimei-auth (Layer B) に redirect。helper (PR5a) で URL 構築を集約することで
// クエリ名 typo / 順序ぶれを防ぐ。Cookie 検証は各ページで行うのは旧設計と同じ。
//
// publicPaths:
// - "/" : LP / 未認証で見える top page
// - "/api/auth": Better Auth callback (OAuth 戻り URL の処理経路)
// - "/auth/after-signin", "/auth/after-signup": Layer B からの着地点 (Cookie 設定の race condition
//   回避のため proxy をスキップ、各ページ側で getSession() で null チェック実装済)
// 旧 "/auth" は publicPaths から削除 (PR10a で page.tsx ごと削除予定、それまでは Layer B に redirect)。
const AUTH_URL =
  process.env.NEXT_PUBLIC_AUTH_URL ?? "https://auth.taimei-code.com";

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const publicPaths = [
    "/",
    "/api/auth",
    "/auth/after-signin",
    "/auth/after-signup",
  ];
  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/"),
  );

  if (isPublicPath) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request, {
    cookiePrefix: "better-auth",
  });

  if (!sessionCookie) {
    const url = buildAuthLoginUrl({
      authBaseUrl: AUTH_URL,
      service: "taimei",
      returnTo: request.url,
    });
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
