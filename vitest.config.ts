import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    globalSetup: ["./app/services/__tests__/db/global-setup.ts"],
    setupFiles: ["./__tests__/utils/setup-tests.ts"],
    // root所有のディレクトリや、テストに不要なディレクトリをスキャン対象から除外
    exclude: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.next/**",
      "**/coverage/**",
      "**/dump/**",
      "**/.{git,cache,output,temp}/**",
      "**/e2e/**",
    ],
  },
  resolve: {
    alias: [
      {
        find: "@",
        replacement: resolve(__dirname, "./"),
      },
      {
        find: "server-only",
        replacement: resolve(
          __dirname,
          "./__tests__/utils/server-only-mock.ts",
        ),
      },
    ],
  },
});
