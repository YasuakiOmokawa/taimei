import { Level, type SkillLevel } from "../../../src/spa-contract";
import type { Cell } from "./skill-matrix";

export const levels: Record<Level, { symbol: string; label: string }> = {
  0: { symbol: "", label: "未経験" },
  1: { symbol: "△", label: "支援があればできる" },
  2: { symbol: "○", label: "一人でできる" },
  3: { symbol: "◎", label: "教えられる" },
};

export const UNRECORDED_MARK = "—";

export const symbolOrBlank = (symbol: string) => symbol || "空欄";

export const levelFromSelectValue = (value: string): Level | undefined =>
  Level.literals.find((level) => String(level) === value);

const UNRECORDED_BUT_WANTS_TO_LEARN = 0;

export const levelEntriesOf = (
  cells: readonly Cell[],
  selectValueOf: (cell: Cell) => string,
  wantsToLearnOf: (cell: Cell) => boolean,
): SkillLevel[] =>
  cells.flatMap((cell) => {
    const wantsToLearn = wantsToLearnOf(cell);
    const level =
      levelFromSelectValue(selectValueOf(cell)) ??
      (wantsToLearn ? UNRECORDED_BUT_WANTS_TO_LEARN : undefined);
    return level === undefined
      ? []
      : [{ skillId: cell.skill.id, level, wantsToLearn }];
  });
