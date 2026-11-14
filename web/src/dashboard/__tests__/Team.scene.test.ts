import { HashMap, Option } from "effect";
import { AsyncData } from "foldkit";
import {
  all,
  Command,
  change,
  click,
  expect,
  expectAll,
  expectOutMessage,
  given,
  label,
  nth,
  role,
  scene,
  submit,
  text,
  withViewInputs,
} from "foldkit/scene";
import { describe, it } from "vitest";
import { SkillId, TeamId } from "../../../../db/ids";
import { ChangedByMutation } from "../changed-by-mutation";
import * as Mutation from "../mutation";
import { init, type Model, OutMessage, update, view } from "../pages/Team";

const TEAM_ID = TeamId.make("00000000-0000-4000-8000-0000000000aa");
const ME = { userId: "u_1", name: "山田 花子" };
const COLLEAGUE = { userId: "u_3", name: "鈴木 一郎" };
const DESIGN = {
  id: SkillId.make("00000000-0000-4000-8000-000000000a01"),
  name: "設計",
};
const BUILD = {
  id: SkillId.make("00000000-0000-4000-8000-000000000a02"),
  name: "実装",
};

const TEAM = {
  id: TEAM_ID,
  name: "開発",
  skills: [DESIGN, BUILD],
  assignedUserIds: [ME.userId, COLLEAGUE.userId],
  levels: [
    {
      userId: ME.userId,
      skillId: DESIGN.id,
      level: 2 as const,
      wantsToLearn: false,
    },
    {
      userId: COLLEAGUE.userId,
      skillId: DESIGN.id,
      level: 3 as const,
      wantsToLearn: true,
    },
  ],
};

const LOADED = { team: TEAM, members: [ME, COLLEAGUE] };

const pageWith = withViewInputs(view, {
  teamId: TEAM_ID,
  myUserId: ME.userId,
  team: AsyncData.Success({ data: LOADED }),
  teamsHref: "/teams-from-application",
});

const page = (...overrides: Parameters<typeof pageWith>) => ({
  update,
  view: pageWith(...overrides),
});

const levelSelectOf = (skillName: string) => label(`${skillName} のレベル`);
const wantsToLearnOf = (skillName: string) => label(`${skillName} を学びたい`);
const saveButton = role("button", { name: "保存" });
const myLevelsForm = role("form");
const myRow = nth(all.selector("tbody tr"), 0);
const alerts = all.role("alert");

const SAVED_ENTRIES = [
  { skillId: DESIGN.id, level: 3 as const, wantsToLearn: false },
  { skillId: BUILD.id, level: 0 as const, wantsToLearn: true },
];

const savedChange = {
  changed: ChangedByMutation.MyLevels({
    teamId: TEAM_ID,
    myUserId: ME.userId,
    entries: SAVED_ENTRIES,
  }),
  maybeCreatedTeamId: Option.none(),
};

describe("星取表", () => {
  it("見出しの名前、application が渡した行き先への戻る link、メンバーとスキルの表、偏りと学びたいの行を描く", () => {
    scene(
      page(),
      given(init()),
      expect(role("heading", { level: 1 })).toHaveText("開発"),
      expect(role("link", { name: "チーム" })).toHaveAttr(
        "href",
        "/teams-from-application",
      ),
      expect(role("heading", { name: "星取表" })).toExist(),
      expectAll(all.selector("thead th")).toHaveCount(3),
      expect(myRow).toHaveText(`${ME.name}○一人でできる—未記入`),
      expect(nth(all.selector("tbody tr"), 1)).toHaveText(
        `${COLLEAGUE.name}◎学教えられる、学びたい—未記入`,
      ),
      expect(nth(all.selector("tfoot td"), 0)).toHaveText(""),
      expect(nth(all.selector("tfoot td"), 1)).toHaveText("偏り"),
      expect(nth(all.selector("tfoot td"), 2)).toHaveText("1"),
    );
  });

  it.each([
    [
      "メンバー一覧が取れない",
      { team: TEAM, members: null },
      "メンバー一覧を取得できませんでした",
    ],
    [
      "スキルが無い",
      { team: { ...TEAM, skills: [], levels: [] }, members: [ME] },
      "下のスキルを足してメンバーを割り当てると、ここに星取表が出ます",
    ],
  ])("%s 時は、表の代わりに案内を描く", (_, loaded, guidance) => {
    scene(
      page({ team: AsyncData.Success({ data: loaded }) }),
      given(init()),
      expect(text(guidance)).toExist(),
      expectAll(all.selector("table")).toHaveCount(0),
    );
  });

  it.each([
    ["まだ取得していない", AsyncData.Idle()],
    ["取得中", AsyncData.Loading()],
  ])("%s 時は、戻る link と読み込み中の文言だけを描く", (_, team) => {
    scene(
      page({ team }),
      given(init()),
      expect(role("link", { name: "チーム" })).toExist(),
      expectAll(all.role("status")).toHaveCount(1),
      expectAll(all.role("heading")).toHaveCount(0),
    );
  });

  it("取得の失敗は、渡された文言を描き、見出しを描かない", () => {
    scene(
      page({ team: AsyncData.Failure({ error: "チームが見つかりません" }) }),
      given(init()),
      expect(text("チームが見つかりません")).toExist(),
      expectAll(all.role("heading")).toHaveCount(0),
    );
  });
});

describe("自分のレベルの form", () => {
  it("割り当てられていなければ、form を描かない", () => {
    scene(
      page({
        team: AsyncData.Success({
          data: {
            ...LOADED,
            team: { ...TEAM, assignedUserIds: [COLLEAGUE.userId] },
          },
        }),
      }),
      given(init()),
      expectAll(all.role("form")).toHaveCount(0),
      expectAll(all.role("button")).toHaveCount(0),
    );
  });

  it("記入済みのスキルは保存したレベルを選び、未記入のスキルは「—: 未記入」を選ぶ", () => {
    scene(
      page(),
      given(init()),
      expect(levelSelectOf(DESIGN.name)).toHaveValue("2"),
      expectAll(
        all.selector(`select[aria-label="${DESIGN.name} のレベル"] option`),
      ).toHaveCount(4),
      expect(levelSelectOf(BUILD.name)).toHaveValue(""),
      expect(
        nth(
          all.selector(`select[aria-label="${BUILD.name} のレベル"] option`),
          0,
        ),
      ).toHaveText("—: 未記入"),
      expect(wantsToLearnOf(DESIGN.name)).not.toBeChecked(),
    );
  });

  it("記入して保存すると、応答を待つ間は自分の行に送った値を描いて button を無効にし、成功すると application に渡す", () => {
    scene(
      page(),
      given(init()),
      change(levelSelectOf(DESIGN.name), "3"),
      click(wantsToLearnOf(BUILD.name)),
      expect(levelSelectOf(DESIGN.name)).toHaveValue("3"),
      expect(wantsToLearnOf(BUILD.name)).toBeChecked(),
      submit(myLevelsForm),
      Command.expectHas(
        Mutation.SaveMyLevels({
          teamId: TEAM_ID,
          myUserId: ME.userId,
          entries: SAVED_ENTRIES,
        }),
      ),
      expect(myRow).toContainText("◎"),
      expect(myRow).toContainText("学"),
      expect(saveButton).toBeDisabled(),
      Command.resolve(
        Mutation.SaveMyLevels,
        Mutation.Message.SucceededMutation(savedChange),
      ),
      expect(saveButton).not.toBeDisabled(),
      expectOutMessage(
        OutMessage.FinishedMutation({
          outcome: Mutation.OutMessage.SucceededMutation(savedChange),
        }),
      ),
    );
  });

  it("失敗すると、alert に文言を描き、自分の行を保存した値に戻し、記入した値を残す", () => {
    scene(
      page(),
      given(init()),
      change(levelSelectOf(DESIGN.name), "3"),
      submit(myLevelsForm),
      Command.resolve(
        Mutation.SaveMyLevels,
        Mutation.Message.FailedMutation({ message: "保存できませんでした" }),
      ),
      expect(role("alert")).toHaveText("保存できませんでした"),
      expect(myRow).toContainText("○"),
      expect(levelSelectOf(DESIGN.name)).toHaveValue("3"),
    );
  });

  it("未記入を選んだ下書きは、そのスキルが記入済みになると、記入済みの値を出して送る", () => {
    const unrecordedDraft: Model = {
      ...init(),
      levelDrafts: HashMap.make([DESIGN.id, ""]),
    };

    scene(
      page(),
      given(unrecordedDraft),
      expect(levelSelectOf(DESIGN.name)).toHaveValue("2"),
      submit(myLevelsForm),
      Command.expectHas(
        Mutation.SaveMyLevels({
          teamId: TEAM_ID,
          myUserId: ME.userId,
          entries: [{ skillId: DESIGN.id, level: 2, wantsToLearn: false }],
        }),
      ),
      Command.resolve(
        Mutation.SaveMyLevels,
        Mutation.Message.FailedMutation({ message: "保存できませんでした" }),
      ),
      expectAll(alerts).toHaveCount(1),
    );
  });
});
