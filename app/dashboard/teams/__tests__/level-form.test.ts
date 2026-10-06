import { expect, it } from "vitest";
import { parseLevelForm } from "../level-form";

const formData = (entries: [string, string][]) => {
  const data = new FormData();
  for (const [name, value] of entries) data.append(name, value);
  return data;
};

it("スキルごとのレベルと学びたいを entry にする。学びたいの checkbox が無ければ false", () => {
  expect(
    parseLevelForm(
      formData([
        ["level:s1", "2"],
        ["wants:s1", "on"],
        ["level:s2", "0"],
      ]),
    ),
  ).toEqual([
    { skillId: "s1", level: "2", wantsToLearn: true },
    { skillId: "s2", level: "0", wantsToLearn: false },
  ]);
});

it("レベルの欄でない名前と、レベルの欄の無い学びたいは無視する", () => {
  expect(
    parseLevelForm(
      formData([
        ["name", "開発"],
        ["wants:s9", "on"],
        ["level:s1", "1"],
      ]),
    ),
  ).toEqual([{ skillId: "s1", level: "1", wantsToLearn: false }]);
});
