import { Option } from "effect";
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
import * as MyLevelsForm from "../my-levels-form";
import { init, isSubmitting, Message, OutMessage, update } from "../pages/Team";

const TEAM_ID = "00000000-0000-4000-8000-0000000000aa";
const DESIGN_ID = SkillId.make("00000000-0000-4000-8000-000000000a01");

const SAVE = { teamId: TEAM_ID, myUserId: "u_1", entries: [] };

const savedChange = {
  changed: ChangedByMutation.MyLevels(SAVE),
  maybeCreatedTeamId: Option.none(),
};

const submittedMyLevels = Message.GotMyLevelsFormMessage({
  message: MyLevelsForm.Message.SubmittedMyLevelsForm(SAVE),
});

describe("チームの page と自分のレベルの記入", () => {
  it("下書きの無い、未送信の状態で始まる", () => {
    expect(init()).toEqual({
      myLevelsForm: MyLevelsForm.init(),
      maybeRenameDraft: Option.none(),
      skillNameDraft: "",
      maybeAssigneeDraft: Option.none(),
      renaming: Submission.Idle(),
      deleting: Submission.Idle(),
      addingSkill: Submission.Idle(),
      removingSkill: Submission.Idle(),
      assigning: Submission.Idle(),
      unassigning: Submission.Idle(),
    });
  });

  it("記入の送信を記入の module に渡し、保存の間は送信中で、成功すると変えた自分のレベルを application に渡す", () => {
    story(
      update,
      given(init()),
      message(submittedMyLevels),
      model((next) => {
        expect(isSubmitting(next)).toBe(true);
      }),
      Command.resolve(
        Mutation.SaveMyLevels,
        Mutation.Message.SucceededMutation(savedChange),
      ),
      model((next) => {
        expect(isSubmitting(next)).toBe(false);
      }),
      expectOutMessage(
        OutMessage.FinishedMutation({
          outcome: Mutation.OutMessage.SucceededMutation(savedChange),
        }),
      ),
    );
  });
});

const teamChanged = {
  changed: ChangedByMutation.Team({ teamId: TEAM_ID }),
  maybeCreatedTeamId: Option.none(),
};

const ADD_SKILL = { teamId: TEAM_ID, name: "テスト" };
const REMOVE_SKILL = {
  teamId: TEAM_ID,
  skillId: DESIGN_ID,
  confirmation: "スキル「設計」を削除します。",
};
const SLOTS = [
  "renaming",
  "deleting",
  "addingSkill",
  "removingSkill",
  "assigning",
  "unassigning",
] as const;

const drafted = { ...init(), skillNameDraft: ADD_SKILL.name };

const REJECTED = Submission.Rejected({
  message: "スキルを削除できませんでした",
});

describe("チームの管理", () => {
  it("名前を書くと、書いた時のチームの名前と組で下書きに入れる", () => {
    const { model: next } = update(
      init(),
      Message.UpdatedTeamName({ value: "営業", editedFrom: "開発" }),
    );

    expect(next.maybeRenameDraft).toEqual(
      Option.some({ value: "営業", editedFrom: "開発" }),
    );
  });

  it.each([
    [
      "名前の変更",
      Message.SubmittedRenameForm({ teamId: TEAM_ID, teamName: "開発" }),
      Mutation.RenameTeam({ teamId: TEAM_ID, name: "開発" }),
      "renaming",
    ],
    [
      "スキルの追加",
      Message.SubmittedAddSkillForm({ teamId: TEAM_ID }),
      Mutation.AddSkill(ADD_SKILL),
      "addingSkill",
    ],
    [
      "割り当て",
      Message.SubmittedAssignForm({
        teamId: TEAM_ID,
        candidateUserIds: ["u_4", "u_5"],
      }),
      Mutation.AssignMember({ teamId: TEAM_ID, userId: "u_4" }),
      "assigning",
    ],
    [
      "スキルの削除",
      Message.ClickedRemoveSkill(REMOVE_SKILL),
      Mutation.RemoveSkill({
        ...REMOVE_SKILL,
        restoredOnCancel: Submission.Idle(),
      }),
      "removingSkill",
    ],
    [
      "外すこと",
      Message.ClickedUnassign({
        teamId: TEAM_ID,
        userId: "u_3",
        confirmation: "外します。",
      }),
      Mutation.UnassignMember({
        teamId: TEAM_ID,
        userId: "u_3",
        confirmation: "外します。",
        restoredOnCancel: Submission.Idle(),
      }),
      "unassigning",
    ],
    [
      "チームの削除",
      Message.ClickedDeleteTeam({
        teamId: TEAM_ID,
        confirmation: "消します。",
      }),
      Mutation.DeleteTeam({
        teamId: TEAM_ID,
        confirmation: "消します。",
        restoredOnCancel: Submission.Idle(),
      }),
      "deleting",
    ],
  ] as const)(
    "%s を始めると、その更新だけが送信中になり、送信した時の下書きで更新の Command を出す",
    (_, started, command, slotId) => {
      story(
        update,
        given(drafted),
        message(started),
        model((next) => {
          expect(next[slotId]).toEqual(Submission.Submitting());
          for (const otherSlot of SLOTS.filter((slot) => slot !== slotId)) {
            expect(next[otherSlot]).toEqual(Submission.Idle());
          }
          expect(isSubmitting(next)).toBe(true);
          expect(MyLevelsForm.isSaving(next.myLevelsForm)).toBe(false);
        }),
        Command.expectHas(command),
        Command.resolve(
          command,
          Mutation.Message.FailedMutation({ message: "x" }),
        ),
      );
    },
  );

  it("送信中にもう一度始めても、更新は 1 回だけ走る", () => {
    const firstSubmit = update(
      init(),
      Message.SubmittedAddSkillForm({ teamId: TEAM_ID }),
    );

    const secondSubmit = update(
      firstSubmit.model,
      Message.SubmittedAddSkillForm({ teamId: TEAM_ID }),
    );

    expect(secondSubmit.commands ?? []).toEqual([]);
    expect(secondSubmit.model).toEqual(firstSubmit.model);
  });

  it("チームの取り直しの間の送信は、何も変えず、更新も出さない", () => {
    const blocked = update(init(), Message.SubmittedWhileRefreshing());

    expect(blocked.model).toEqual(init());
    expect(blocked.commands ?? []).toEqual([]);
  });

  it("スキルの追加が成功すると、スキル名の下書きを空にし、変えたチームを application に渡す", () => {
    story(
      update,
      given(
        update(init(), Message.UpdatedSkillName({ value: "テスト" })).model,
      ),
      message(Message.SubmittedAddSkillForm({ teamId: TEAM_ID })),
      Command.resolve(
        Mutation.AddSkill,
        Mutation.Message.SucceededMutation(teamChanged),
      ),
      model((next) => {
        expect(next.skillNameDraft).toBe("");
        expect(next.addingSkill).toEqual(Submission.Idle());
      }),
      expectOutMessage(
        OutMessage.FinishedMutation({
          outcome: Mutation.OutMessage.SucceededMutation(teamChanged),
        }),
      ),
    );
  });

  it("スキルの追加が失敗すると、スキル名の下書きを残す", () => {
    story(
      update,
      given(update(init(), Message.UpdatedSkillName({ value: "設計" })).model),
      message(Message.SubmittedAddSkillForm({ teamId: TEAM_ID })),
      Command.resolve(
        Mutation.AddSkill,
        Mutation.Message.FailedMutation({
          message: "同じ名前がすでにあります",
        }),
      ),
      model((next) => {
        expect(next.skillNameDraft).toBe("設計");
      }),
      expectNoOutMessage(),
    );
  });

  it("確認を取り消すと、送信の前の失敗の文言に戻し、application には何も渡さない", () => {
    const failedBefore = { ...init(), removingSkill: REJECTED };

    story(
      update,
      given(failedBefore),
      message(Message.ClickedRemoveSkill(REMOVE_SKILL)),
      Command.expectHas(
        Mutation.RemoveSkill({ ...REMOVE_SKILL, restoredOnCancel: REJECTED }),
      ),
      Command.resolve(
        Mutation.RemoveSkill,
        Mutation.Message.CanceledMutation({ restored: REJECTED }),
      ),
      model((next) => {
        expect(next.removingSkill).toEqual(REJECTED);
        expect(isSubmitting(next)).toBe(false);
      }),
      expectNoOutMessage(),
    );
  });

  it("管理の更新の送信中は保存中ではなく、保存の値で星取表を描く判定は保存だけを見る", () => {
    const adding = update(
      init(),
      Message.SubmittedAddSkillForm({ teamId: TEAM_ID }),
    ).model;

    expect(isSubmitting(adding)).toBe(true);
    expect(MyLevelsForm.isSaving(adding.myLevelsForm)).toBe(false);
  });
});

describe("割り当ての下書き", () => {
  const ASSIGN = { teamId: TEAM_ID, candidateUserIds: ["u_4", "u_5"] as const };

  it("候補に在る下書きを送り、成功すると下書きを消す", () => {
    story(
      update,
      given({ ...init(), maybeAssigneeDraft: Option.some("u_5") }),
      message(Message.SubmittedAssignForm(ASSIGN)),
      Command.expectHas(
        Mutation.AssignMember({ teamId: TEAM_ID, userId: "u_5" }),
      ),
      Command.resolve(
        Mutation.AssignMember,
        Mutation.Message.SucceededMutation(teamChanged),
      ),
      model((next) => {
        expect(next.maybeAssigneeDraft).toEqual(Option.none());
      }),
    );
  });

  it("候補に無い下書きは使わず、先頭の候補を送る", () => {
    story(
      update,
      given({ ...init(), maybeAssigneeDraft: Option.some("u_9") }),
      message(Message.SubmittedAssignForm(ASSIGN)),
      Command.expectHas(
        Mutation.AssignMember({ teamId: TEAM_ID, userId: "u_4" }),
      ),
      Command.resolve(
        Mutation.AssignMember,
        Mutation.Message.FailedMutation({ message: "x" }),
      ),
    );
  });
});

describe("名前の下書き", () => {
  it("送信した時に、書いた時のチームの名前が今の名前と同じ下書きを送る", () => {
    story(
      update,
      given(
        update(
          init(),
          Message.UpdatedTeamName({ value: "営業", editedFrom: "開発" }),
        ).model,
      ),
      message(
        Message.SubmittedRenameForm({ teamId: TEAM_ID, teamName: "開発" }),
      ),
      Command.expectHas(Mutation.RenameTeam({ teamId: TEAM_ID, name: "営業" })),
      Command.resolve(
        Mutation.RenameTeam,
        Mutation.Message.FailedMutation({ message: "x" }),
      ),
    );
  });
});
