import { withSentryConfig } from "@sentry/nextjs";

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
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "dd37d93208f4",
  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
  // See the following for more information:
  // https://docs.sentry.io/product/crons/
  // https://vercel.com/docs/cron-jobs
  automaticVercelMonitors: true,
});
