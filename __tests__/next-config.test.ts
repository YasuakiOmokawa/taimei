import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// ADR-008 retrospective で発覚した dev workflow 問題の再発防止。
//
// Next.js 16 から default 有効化された dev server の cross-origin 保護が
// `app.taimei-code.local` を不明 host として blocking し、RSC stream / hydration が
// silently fail する症状があった (PR #512)。本リポは README で /etc/hosts に
// `app.taimei-code.local` を追加して dev 動作確認する運用なので、この host を
// `next.config.mjs` の `allowedDevOrigins` で明示 allowlist する必要がある。
// turbopack mode では warning も出ず原因特定が困難だったため、設定漏れを test で
// 検出することで再発を防ぐ。
//
// production build (`next start`) では allowedDevOrigins は影響しないため、
// 本 test は dev workflow 専用の guard。

describe("next.config dev workflow", () => {
  it("allowedDevOrigins に app.taimei-code.local を含む (README dev 運用の前提)", () => {
    const config = readFileSync(
      path.resolve(__dirname, "../next.config.mjs"),
      "utf-8",
    );
    expect(config).toMatch(
      /allowedDevOrigins[\s\S]*?["']app\.taimei-code\.local["']/,
    );
  });
});
