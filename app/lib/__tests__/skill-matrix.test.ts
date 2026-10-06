import { expect, it } from "vitest";
import { buildSkillMatrix } from "../skill-matrix";

const member = (userId: string) => ({ userId, name: userId, email: "" });

it("行はメンバーの順、セルはスキルの順で、記入の無いセルは未記入の未経験・学びたいなし", () => {
  const { rows } = buildSkillMatrix(
    [{ id: "s1" }, { id: "s2" }],
    [member("u_2"), member("u_1")],
    [
      { userId: "u_1", skillId: "s2", level: 3, wantsToLearn: true },
      { userId: "u_2", skillId: "s1", level: 1, wantsToLearn: false },
    ],
  );

  expect(rows).toEqual([
    {
      member: member("u_2"),
      cells: [
        { level: 1, wantsToLearn: false, recorded: true },
        { level: 0, wantsToLearn: false, recorded: false },
      ],
    },
    {
      member: member("u_1"),
      cells: [
        { level: 0, wantsToLearn: false, recorded: false },
        { level: 3, wantsToLearn: true, recorded: true },
      ],
    },
  ]);
});

it("一人でできる以上が 0 人と 1 人のスキルは偏り、2 人なら偏りでない。△ は数えない", () => {
  const skills = [{ id: "none" }, { id: "one" }, { id: "two" }, { id: "weak" }];
  const { skillSummaries } = buildSkillMatrix(
    skills,
    [member("u_1"), member("u_2")],
    [
      { userId: "u_1", skillId: "one", level: 2, wantsToLearn: false },
      { userId: "u_1", skillId: "two", level: 2, wantsToLearn: false },
      { userId: "u_2", skillId: "two", level: 3, wantsToLearn: false },
      { userId: "u_1", skillId: "weak", level: 1, wantsToLearn: false },
      { userId: "u_2", skillId: "weak", level: 1, wantsToLearn: false },
    ],
  );

  expect(skillSummaries.map((summary) => summary.isBiased)).toEqual([
    true,
    true,
    false,
    true,
  ]);
});

it("スキルごとに学びたいメンバーを数え、未経験 (0) の人も数える", () => {
  const { skillSummaries } = buildSkillMatrix(
    [{ id: "s1" }, { id: "s2" }],
    [member("u_1"), member("u_2")],
    [
      { userId: "u_1", skillId: "s1", level: 0, wantsToLearn: true },
      { userId: "u_2", skillId: "s1", level: 3, wantsToLearn: true },
      { userId: "u_1", skillId: "s2", level: 2, wantsToLearn: false },
    ],
  );

  expect(skillSummaries.map((summary) => summary.wantsToLearnCount)).toEqual([
    2, 0,
  ]);
});

it("割り当てたメンバーにいない人の記入は、行にも偏りにも学びたいの人数にも入れない", () => {
  const withDeparted = buildSkillMatrix(
    [{ id: "s1" }],
    [member("u_1")],
    [
      { userId: "u_1", skillId: "s1", level: 2, wantsToLearn: false },
      { userId: "u_gone", skillId: "s1", level: 3, wantsToLearn: true },
    ],
  );
  const without = buildSkillMatrix(
    [{ id: "s1" }],
    [member("u_1")],
    [{ userId: "u_1", skillId: "s1", level: 2, wantsToLearn: false }],
  );

  expect(withDeparted).toEqual(without);
});

it("行はメンバーとセルだけを持ち、人ごとの合計や順位を持たない", () => {
  const { rows } = buildSkillMatrix(
    [{ id: "s1" }],
    [member("u_1")],
    [{ userId: "u_1", skillId: "s1", level: 3, wantsToLearn: true }],
  );

  expect(Object.keys(rows[0]).sort()).toEqual(["cells", "member"]);
});

it("未経験 (0) と記入した人と、まだ記入していない人を区別する", () => {
  const { rows } = buildSkillMatrix(
    [{ id: "s1" }],
    [member("u_1"), member("u_2")],
    [{ userId: "u_1", skillId: "s1", level: 0, wantsToLearn: false }],
  );

  expect(rows.map((row) => row.cells[0].recorded)).toEqual([true, false]);
});
