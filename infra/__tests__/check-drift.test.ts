import { describe, expect, it } from "vitest";
import { differingOperationLines } from "../check-drift";

describe("alchemy の plan と drift の出力を読む", () => {
  it("noop と unchanged だけなら差は無い", () => {
    expect(
      differingOperationLines("[App] noop\n[Hyperdrive] unchanged\n"),
    ).toEqual([]);
  });

  it("no changes なら差は無い", () => {
    expect(differingOperationLines("No changes.\n")).toEqual([]);
  });

  it("noop と unchanged 以外の操作の行を差として返す", () => {
    expect(
      differingOperationLines(
        "[App] update (domain)\n[Hyperdrive] noop\n[Store] delete\n",
      ),
    ).toEqual(["[App] update", "[Store] delete"]);
  });

  it("Effect の log の前置きを外してから読む", () => {
    expect(
      differingOperationLines("[12:00:00.000] INFO (#1) plan: [App] update\n"),
    ).toEqual(["[App] update"]);
  });

  it("操作の行も no changes も無い出力は、形が変わったとして失敗する", () => {
    expect(() => differingOperationLines("something else\n")).toThrow();
  });
});
