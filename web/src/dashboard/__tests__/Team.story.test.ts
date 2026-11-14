import { HashMap, Option } from "effect";
import {
  Command,
  expectNoOutMessage,
  expectOutMessage,
  given,
  message,
  model,
  story,
} from "foldkit/story";
import { describe, expect, it } from "vitest";
import { SkillId } from "../../../../db/ids";
import { Submission } from "../../shared/submission";
import { ChangedByMutation } from "../changed-by-mutation";
import * as Mutation from "../mutation";
import { init, isSaving, Message, OutMessage, update } from "../pages/Team";

const TEAM_ID = "00000000-0000-4000-8000-0000000000aa";
const MY_USER_ID = "u_1";
const DESIGN_ID = SkillId.make("00000000-0000-4000-8000-000000000a01");
const BUILD_ID = SkillId.make("00000000-0000-4000-8000-000000000a02");

const ENTRIES = [
  { skillId: DESIGN_ID, level: 3 as const, wantsToLearn: false },
  { skillId: BUILD_ID, level: 0 as const, wantsToLearn: true },
];
const OTHER_ENTRIES = [
  { skillId: DESIGN_ID, level: 1 as const, wantsToLearn: false },
];

const SAVE = { teamId: TEAM_ID, myUserId: MY_USER_ID, entries: ENTRIES };

const submitted = Message.SubmittedMyLevelsForm(SAVE);

const savedChange = {
  changed: ChangedByMutation.MyLevels(SAVE),
  maybeCreatedTeamId: Option.none(),
};

const saved = Mutation.Message.SucceededMutation(savedChange);

const savedOutcome = OutMessage.FinishedMutation({
  outcome: Mutation.OutMessage.SucceededMutation(savedChange),
});

const filled = update(
  update(init(), Message.SelectedLevel({ skillId: DESIGN_ID, value: "3" }))
    .model,
  Message.ToggledWantsToLearn({ skillId: BUILD_ID, isChecked: true }),
).model;

describe("自分のレベルの記入", () => {
  it("下書きの無い、未送信の状態で始まる", () => {
    expect(init()).toEqual({
      levelDrafts: HashMap.empty(),
      wantsToLearnDrafts: HashMap.empty(),
      pendingEntries: [],
      saving: Submission.Idle(),
    });
  });

  it("選んだレベルと学びたいの toggle を、スキルごとの下書きに入れる", () => {
    expect(HashMap.get(filled.levelDrafts, DESIGN_ID)).toEqual(
      Option.some("3"),
    );
    expect(HashMap.get(filled.wantsToLearnDrafts, BUILD_ID)).toEqual(
      Option.some(true),
    );
  });
});

describe("自分のレベルの保存", () => {
  it("送信すると送信中になり、保存中の値を持ち、送った値の保存を出す", () => {
    story(
      update,
      given(filled),
      message(submitted),
      model((next) => {
        expect(isSaving(next)).toBe(true);
        expect(next.pendingEntries).toEqual(ENTRIES);
      }),
      Command.expectHas(Mutation.SaveMyLevels(SAVE)),
      Command.resolve(Mutation.SaveMyLevels, saved),
    );
  });

  it("送信中にもう一度送信しても、保存は 1 回だけ走り、保存中の値も替えない", () => {
    const firstSubmit = update(filled, submitted);

    const secondSubmit = update(
      firstSubmit.model,
      Message.SubmittedMyLevelsForm({ ...SAVE, entries: OTHER_ENTRIES }),
    );

    expect(secondSubmit.commands ?? []).toEqual([]);
    expect(secondSubmit.model).toEqual(firstSubmit.model);
  });

  it("成功すると未送信に戻り、下書きを残し、変えた自分のレベルを application に渡す", () => {
    story(
      update,
      given(filled),
      message(submitted),
      Command.resolve(Mutation.SaveMyLevels, saved),
      model((next) => {
        expect(next.saving).toEqual(Submission.Idle());
        expect(next.levelDrafts).toEqual(filled.levelDrafts);
        expect(next.wantsToLearnDrafts).toEqual(filled.wantsToLearnDrafts);
      }),
      expectOutMessage(savedOutcome),
    );
  });

  it("失敗すると、失敗の文言を表示に渡し、下書きを残し、application には何も渡さない", () => {
    story(
      update,
      given(filled),
      message(submitted),
      Command.resolve(
        Mutation.SaveMyLevels,
        Mutation.Message.FailedMutation({
          message: "チームに割り当てられた人だけが記入できます",
        }),
      ),
      model((next) => {
        expect(next.saving).toEqual(
          Submission.Rejected({
            message: "チームに割り当てられた人だけが記入できます",
          }),
        );
        expect(isSaving(next)).toBe(false);
        expect(next.levelDrafts).toEqual(filled.levelDrafts);
      }),
      expectNoOutMessage(),
    );
  });

  it.each([
    [
      "401",
      Mutation.Message.RequiredSignIn(),
      Mutation.OutMessage.RequiredSignIn(),
    ],
    [
      "session の変化",
      Mutation.Message.ChangedSession(),
      Mutation.OutMessage.ChangedSession(),
    ],
  ])(
    "保存が %s を受けると、送信中のまま application に渡す",
    (_, settled, outcome) => {
      story(
        update,
        given(filled),
        message(submitted),
        Command.resolve(Mutation.SaveMyLevels, settled),
        model((next) => {
          expect(isSaving(next)).toBe(true);
        }),
        expectOutMessage(OutMessage.FinishedMutation({ outcome })),
      );
    },
  );
});
