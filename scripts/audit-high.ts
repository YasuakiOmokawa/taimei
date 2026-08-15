import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const storybookAdapter = "@storybook/experimental-nextjs-vite";

type PackageManifest = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const expectedImageSizePath = [
  /^image-size@2\.0\.2$/,
  /^└─ vite-plugin-storybook-nextjs@[^ ]+ \(requires \^2\.0\.0\)$/,
  /^└─ @storybook\/experimental-nextjs-vite@[^ ]+ \(requires \^1\.1\.5\)$/,
];

export function assertImageSizeIsStorybookOnly(whyOutput: string): void {
  const dependencyPath = whyOutput
    .replaceAll(/\u001B\[[0-9;]*m/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const isStorybookOnly =
    dependencyPath.length === expectedImageSizePath.length &&
    expectedImageSizePath.every((pattern, index) =>
      pattern.test(dependencyPath[index]),
    );

  if (!isStorybookOnly) {
    throw new Error(
      `image-size audit exception is no longer Storybook-only:\n${whyOutput}`,
    );
  }
}

export function assertStorybookAdapterIsDevelopmentOnly(
  manifest: PackageManifest,
): void {
  if (
    manifest.dependencies?.[storybookAdapter] !== undefined ||
    manifest.devDependencies?.[storybookAdapter] === undefined
  ) {
    throw new Error("Storybook audit exception is no longer development-only");
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const manifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as PackageManifest;
  assertStorybookAdapterIsDevelopmentOnly(manifest);

  const why = spawnSync("bun", ["pm", "why", "image-size"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });

  if (why.status !== 0) {
    process.exit(why.status ?? 1);
  }

  assertImageSizeIsStorybookOnly(why.stdout);

  const audit = spawnSync(
    "bun",
    [
      "audit",
      "--audit-level=high",
      "--ignore=GHSA-w3rx-r6r6-pgpr",
      "--ignore=GHSA-5p2g-fcmc-qvqq",
    ],
    { stdio: "inherit" },
  );

  process.exit(audit.status ?? 1);
}
