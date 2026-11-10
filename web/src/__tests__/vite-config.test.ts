import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { loadConfigFromFile } from "vite";
import { expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../..");

const STATIC_IMPORT_CONFIG = `import { foldkit } from "@foldkit/vite-plugin";

export default { plugins: [foldkit()] };
`;

it("@foldkit/vite-plugin は ESM 専用で、CommonJS として読まれる vite の設定 (.ts) が static に import すると vite は設定を読めない (web/vite.config.ts が設定の関数の中で dynamic import する理由。設定を .mts にしたら static に戻せる)", async () => {
  const fixtureDir = mkdtempSync(path.join(tmpdir(), "taimei-vite-config-"));
  try {
    symlinkSync(
      path.join(REPO_ROOT, "node_modules"),
      path.join(fixtureDir, "node_modules"),
    );
    writeFileSync(path.join(fixtureDir, "package.json"), "{}");
    writeFileSync(
      path.join(fixtureDir, "vite.config.ts"),
      STATIC_IMPORT_CONFIG,
    );

    await expect(
      loadConfigFromFile(
        { command: "build", mode: "production" },
        path.join(fixtureDir, "vite.config.ts"),
        fixtureDir,
        "silent",
      ),
    ).rejects.toThrow(/ESM only/);
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});
