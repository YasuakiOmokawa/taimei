import { describe, expect, it } from "vitest";
import { generatePagination, parsePage } from "../pagination";

describe("parsePage", () => {
  it.each([
    ["1", 1],
    ["2", 2],
    ["9007199254740991", 9007199254740991],
  ])("1 以上の安全な整数 %s はそのまま返す", (raw, page) => {
    expect(parsePage(raw)).toBe(page);
  });

  it.each([
    ["0"],
    ["-3"],
    ["1.3"],
    ["2.7"],
    [""],
    ["abc"],
    ["Infinity"],
    ["9007199254740992"],
    [null],
    [undefined],
  ])("%s は 1 を返す", (raw) => {
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
