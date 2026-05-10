import { buildAuthLoginUrl, hasAuthCookie } from "@taimei-code/auth-client";
import { NextRequest, NextResponse } from "next/server";

// 未認証なら taimei-auth (認証サーバー) に redirect。
// @taimei-code/auth-client の buildAuthLoginUrl で URL 構築を、hasAuthCookie で session cookie の
// 存在判定を SDK に集約する (cookie 名は SDK 内部詳細、ADR-004 Stage A)。
//
// publicPaths:
// - "/" : LP / 未認証で見える top page
// - "/auth/after-signin", "/auth/after-signup": taimei-auth からの着地点 (Cookie 設定の race condition
//   回避のため proxy をスキップ、各ページ側で getSession() で null チェック実装済)
const AUTH_URL =
  process.env.NEXT_PUBLIC_AUTH_URL ?? "https://auth.taimei-code.com";

// Next.js v16 middleware の request.url は internal listen address (例: localhost:3001) を
// 返すケースがあり、taimei-auth の URL allowlist で弾かれる。NEXT_PUBLIC_APP_URL を base に
// pathname + search を組んで明示的に絶対 URL を作る。
const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://app.taimei-code.com";

const AFTER_SIGNIN_URL = `${APP_URL}/auth/after-signin`;
const AFTER_SIGNUP_URL = `${APP_URL}/auth/after-signup`;

const redirectToAuth = (returnTo: string) =>
  NextResponse.redirect(
    buildAuthLoginUrl({
      authBaseUrl: AUTH_URL,
      service: "taimei",
      returnTo,
      signUpUrl: AFTER_SIGNUP_URL,
    }),
  );

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /auth はログイン入口 path。常に taimei-auth に redirect する (cookie 有無を問わず):
  // - getSessionCookie は cookie の「存在」のみ判定するため、stale な session_token が
  //   残ると next() に流れて app/auth/page.tsx 不在ゆえ Next.js が 404 を返す
  // - Cookie 検証 (DB 接続) は proxy では行わず taimei-auth に委譲する責務分離
  // returnTo は /auth/after-signin に固定 (publicPaths 含み、認証後の dispatch を担う)。
  // signUpUrl=after-signup で sign-up 完了時の welcome=1 + 5 分窓 gate に乗せる。
  if (pathname === "/auth") {
    return redirectToAuth(AFTER_SIGNIN_URL);
  }

  const publicPaths = ["/", "/auth/after-signin", "/auth/after-signup"];
  const isPublicPath = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(path + "/"),
  );

  if (isPublicPath) {
    return NextResponse.next();
  }

  if (!hasAuthCookie(request)) {
    // 保護ページに未認証アクセス → 元の path に戻すため returnTo は元 pathname を維持。
    return redirectToAuth(`${APP_URL}${pathname}${request.nextUrl.search}`);
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
