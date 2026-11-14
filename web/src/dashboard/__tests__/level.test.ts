import { expect, it } from "vitest";
import type { SkillId } from "../../../../db/ids";
import { levelEntriesOf, levelFromSelectValue, levels } from "../level";
import type { Cell } from "../skill-matrix";

it("記号は未経験が空欄、△・○・◎ の順", () => {
  expect(Object.values(levels).map(({ symbol }) => symbol)).toEqual([
    "",
    "△",
    "○",
    "◎",
  ]);
});

it("select の値の 0〜3 だけをレベルにする", () => {
  expect(["0", "1", "2", "3"].map(levelFromSelectValue)).toEqual([0, 1, 2, 3]);
  expect(["4", "-1", "", "a", "1.0"].map(levelFromSelectValue)).toEqual([
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
  ]);
});

const cellOf = (n: number, recorded: boolean): Cell => ({
  skill: { id: `s${n}` as SkillId, name: `スキル${n}` },
  level: 0,
  wantsToLearn: false,
  recorded,
});

const shown =
  (values: Readonly<Record<string, { level: string; wantsToLearn?: true }>>) =>
  (cells: readonly Cell[]) =>
    levelEntriesOf(
      cells,
      (cell) => values[cell.skill.id]?.level ?? "",
      (cell) => values[cell.skill.id]?.wantsToLearn === true,
    );

it("選んだレベルと学びたいを、スキルの順に保存の entry にする", () => {
  const cells = [cellOf(1, true), cellOf(2, false)];

  const entries = shown({
    s1: { level: "3", wantsToLearn: true },
    s2: { level: "0" },
  })(cells);

  expect(entries).toEqual([
    { skillId: "s1", level: 3, wantsToLearn: true },
    { skillId: "s2", level: 0, wantsToLearn: false },
  ]);
});

it("未記入のまま学びたいも付けないスキルは送らず、未記入のままにする", () => {
  const entries = shown({ s1: { level: "" } })([cellOf(1, false)]);

  expect(entries).toEqual([]);
});

it("未記入のまま学びたいを付けたスキルは、未経験で学びたいとして送る", () => {
  const entries = shown({ s1: { level: "", wantsToLearn: true } })([
    cellOf(1, false),
  ]);

  expect(entries).toEqual([{ skillId: "s1", level: 0, wantsToLearn: true }]);
});
