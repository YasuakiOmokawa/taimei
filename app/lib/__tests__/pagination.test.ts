import { describe, expect, it } from "vitest";
import { generatePagination, parsePage } from "../pagination";

describe("parsePage", () => {
  it.each([
    ["下限", "1", 1],
    ["安全な整数の上限", "9007199254740991", 9007199254740991],
  ])("%s %s はそのまま返す", (_, raw, page) => {
    expect(parsePage(raw)).toBe(page);
  });

  it.each([
    ["下限未満", "0"],
    ["非整数", "1.3"],
    ["数値でない", "abc"],
    ["安全な整数の上限超え", "9007199254740992"],
    ["page が無い (URLSearchParams.get)", null],
    ["page が無い (searchParams.page)", undefined],
  ])("%s %s は 1 を返す", (_, raw) => {
    expect(parsePage(raw)).toBe(1);
  });
});

describe("generatePagination", () => {
  it.each([
    [1, 0, []],
    [1, 7, [1, 2, 3, 4, 5, 6, 7]],
    [1, 8, [1, 2, 3, "...", 7, 8]],
    [3, 10, [1, 2, 3, "...", 9, 10]],
    [4, 10, [1, "...", 3, 4, 5, "...", 10]],
    [7, 10, [1, "...", 6, 7, 8, "...", 10]],
    [8, 10, [1, 2, "...", 8, 9, 10]],
    [99, 10, [1, 2, "...", 8, 9, 10]],
  ])("page %i / %i → %j", (currentPage, totalPages, pages) => {
    expect(generatePagination(currentPage, totalPages)).toEqual(pages);
  });
});
