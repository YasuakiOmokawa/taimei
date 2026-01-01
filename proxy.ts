import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Better Auth 用のプロキシ（セッションCookieの存在チェックのみ）
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 認証不要なパス
  const publicPaths = ["/", "/auth", "/api/auth"];
  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/")
  );

  if (isPublicPath) {
    return NextResponse.next();
  }

  // セッションCookieの存在チェック（検証は各ページで行う）
  const sessionCookie = getSessionCookie(request, {
    cookiePrefix: "better-auth",
  });

  if (!sessionCookie) {
    const authUrl = new URL("/auth", request.url);
    authUrl.searchParams.set("callbackUrl", request.url);
    return NextResponse.redirect(authUrl);
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
