import { describe, expect, it } from "vitest";
import {
  assertImageSizeIsStorybookOnly,
  assertStorybookAdapterIsDevelopmentOnly,
} from "./audit-high";

describe("assertImageSizeIsStorybookOnly", () => {
  const storybookOnlyPath = `image-size@2.0.2
  └─ vite-plugin-storybook-nextjs@1.1.5 (requires ^2.0.0)
     └─ @storybook/experimental-nextjs-vite@8.6.14 (requires ^1.1.5)`;

  it("accepts the single Storybook development dependency path", () => {
    expect(() =>
      assertImageSizeIsStorybookOnly(storybookOnlyPath),
    ).not.toThrow();
  });

  it("rejects an additional dependency path", () => {
    const productionPath = `${storybookOnlyPath}
  └─ next@16.3.0 (requires ^2.0.0)`;

    expect(() => assertImageSizeIsStorybookOnly(productionPath)).toThrow(
      "image-size audit exception is no longer Storybook-only",
    );
  });
});

describe("assertStorybookAdapterIsDevelopmentOnly", () => {
  it("accepts the Storybook adapter as a development dependency", () => {
    expect(() =>
      assertStorybookAdapterIsDevelopmentOnly({
        dependencies: {},
        devDependencies: {
          "@storybook/experimental-nextjs-vite": "8.6.14",
        },
      }),
    ).not.toThrow();
  });

  it("rejects moving the Storybook adapter to production dependencies", () => {
    expect(() =>
      assertStorybookAdapterIsDevelopmentOnly({
        dependencies: { "@storybook/experimental-nextjs-vite": "8.6.14" },
        devDependencies: {},
      }),
    ).toThrow("Storybook audit exception is no longer development-only");
  });
});
