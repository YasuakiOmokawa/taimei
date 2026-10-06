import { canDoAlone, type Level } from "@/app/services/level";

type RecordedValue = { readonly level: Level; readonly wantsToLearn: boolean };
type LevelRow = RecordedValue & {
  readonly userId: string;
  readonly skillId: string;
};
type Cell = RecordedValue & { readonly recorded: boolean };

const MAX_CAN_DO_ALONE_IN_BIASED_SKILL = 1;

const UNRECORDED_CELL: Cell = {
  level: 0,
  wantsToLearn: false,
  recorded: false,
};

export const buildSkillMatrix = <M extends { readonly userId: string }>(
  skills: readonly { id: string }[],
  assignedMembers: readonly M[],
  levels: readonly LevelRow[],
) => {
  const recordedCells = new Map(
    levels.map((row) => [`${row.userId}/${row.skillId}`, row]),
  );
  const rows = assignedMembers.map((member) => ({
    member,
    cells: skills.map((skill): Cell => {
      const row = recordedCells.get(`${member.userId}/${skill.id}`);
      return row
        ? { level: row.level, wantsToLearn: row.wantsToLearn, recorded: true }
        : UNRECORDED_CELL;
    }),
  }));
  const skillSummaries = skills.map((skill, i) => {
    const cells = rows.map((row) => row.cells[i]);
    return {
      skillId: skill.id,
      isBiased:
        cells.filter((cell) => canDoAlone(cell.level)).length <=
        MAX_CAN_DO_ALONE_IN_BIASED_SKILL,
      wantsToLearnCount: cells.filter((cell) => cell.wantsToLearn).length,
    };
  });
  return { rows, skillSummaries };
};
