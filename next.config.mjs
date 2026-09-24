import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */

const nextConfig = {
  turbopack: {},
  // Next.js 16 から dev server の cross-origin 保護が default 有効化された結果、
  // `app.taimei-code.local` のような custom host で dev resources (RSC stream / HMR) が
  // silently blocked され client-side hydration が完全停止する。本リポは README で
  // /etc/hosts に `app.taimei-code.local` を追加して dev 動作確認する運用なので、
  // この host を明示的に allowlist する。turbopack mode では warning も出ず原因特定が
  // 困難なため、開発者導線として必須設定。
  allowedDevOrigins: ["app.taimei-code.local"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: process.env.BLOB_HOSTNAME ?? "example.com",
        port: "",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
};

export default withSentryConfig(nextConfig, {
  org: "dd37d93208f4",
  project: "javascript-nextjs",
  silent: !process.env.CI,
  widenClientFileUpload: true,
});
