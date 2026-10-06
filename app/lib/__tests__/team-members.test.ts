import { expect, it } from "vitest";
import { splitByAssignment } from "../team-members";

const member = (userId: string) => ({ userId, name: userId, email: "" });

it("一覧の順で割り当てたメンバーと候補に分け、一覧にいない割り当ては事業所にいない人として分ける", () => {
  const members = [member("u_1"), member("u_2"), member("u_3")];

  const { assigned, candidates, departedUserIds } = splitByAssignment(members, [
    "u_gone",
    "u_3",
  ]);

  expect(assigned.map((m) => m.userId)).toEqual(["u_3"]);
  expect(candidates.map((m) => m.userId)).toEqual(["u_1", "u_2"]);
  expect(departedUserIds).toEqual(["u_gone"]);
});
