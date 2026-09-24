import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  globalIgnores([
    ".next/",
    "node_modules/",
    "storybook-static/",
    "coverage/",
    "drizzle/migrations/",
    "app/_proto/",
    "e2e/playwright-report/",
    "e2e/test-results/",
    "stories/",
  ]),
]);
