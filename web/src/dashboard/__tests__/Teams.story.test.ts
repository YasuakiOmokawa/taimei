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
import { Submission } from "../../shared/submission";
import { ChangedByMutation } from "../changed-by-mutation";
import * as Mutation from "../mutation";
import {
  init,
  Message,
  type Model,
  OutMessage,
  resetUnlessSubmitting,
  update,
} from "../pages/Teams";

const CREATED_TEAM_ID = "00000000-0000-4000-8000-0000000000cc";

const named = (nameDraft: string): Model =>
  update(init(), Message.UpdatedTeamName({ value: nameDraft })).model;

const CREATED_TEAM = {
  changed: ChangedByMutation.TeamList(),
  maybeCreatedTeamId: Option.some(CREATED_TEAM_ID),
};

const created = Mutation.Message.SucceededMutation(CREATED_TEAM);

const createdOutcome = OutMessage.FinishedMutation({
  outcome: Mutation.OutMessage.SucceededMutation(CREATED_TEAM),
});

const rejected = (rejection: string) =>
  Mutation.Message.FailedMutation({ message: rejection });

describe("チームの一覧の page の名前の form", () => {
  it("空の名前と、未送信の状態で始まる", () => {
    expect(init()).toEqual({ nameDraft: "", creation: Submission.Idle() });
  });

  it("送信すると送信中になり、入力した名前の作成を出す", () => {
    const formSubmit = update(named("開発"), Message.SubmittedCreateTeamForm());

    expect(formSubmit.model.creation).toEqual(Submission.Submitting());
    expect(formSubmit.commands).toMatchObject([
      { name: Mutation.CreateTeam.name, args: { name: "開発" } },
    ]);
  });

  it("送信中にもう一度送信しても、作成は 1 回だけ走る", () => {
    const formSubmit = update(named("開発"), Message.SubmittedCreateTeamForm());

    const secondSubmit = update(
      formSubmit.model,
      Message.SubmittedCreateTeamForm(),
    );

    expect(secondSubmit.commands ?? []).toEqual([]);
    expect(secondSubmit.model).toEqual(formSubmit.model);
  });

  it("成功すると、名前を空にして未送信に戻り、変えたものと新しいチームの id を application に渡す", () => {
    story(
      update,
      given(named("開発")),
      message(Message.SubmittedCreateTeamForm()),
      Command.resolve(Mutation.CreateTeam, created),
      model((next) => {
        expect(next).toEqual(init());
      }),
      expectOutMessage(createdOutcome),
    );
  });

  it("失敗すると、契約の失敗の文言を表示に渡し、名前を残し、application には何も渡さない (一覧に印を付けない)", () => {
    story(
      update,
      given(named("開発")),
      message(Message.SubmittedCreateTeamForm()),
      Command.resolve(
        Mutation.CreateTeam,
        rejected("同じ名前がすでにあります"),
      ),
      model((next) => {
        expect(next).toEqual({
          nameDraft: "開発",
          creation: Submission.Rejected({
            message: "同じ名前がすでにあります",
          }),
        });
      }),
      expectNoOutMessage(),
    );
  });

  it("失敗の後の成功は、失敗の表示を消してから、成功を application に渡す", () => {
    story(
      update,
      given(named("開発")),
      message(Message.SubmittedCreateTeamForm()),
      Command.resolve(
        Mutation.CreateTeam,
        rejected("同じ名前がすでにあります"),
      ),
      message(Message.UpdatedTeamName({ value: "営業" })),
      message(Message.SubmittedCreateTeamForm()),
      Command.resolve(Mutation.CreateTeam, created),
      model((next) => {
        expect(next.creation).toEqual(Submission.Idle());
      }),
      expectOutMessage(createdOutcome),
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
    "作成が %s を受けると、送信中のまま application に渡す",
    (_, settled, outcome) => {
      story(
        update,
        given(named("開発")),
        message(Message.SubmittedCreateTeamForm()),
        Command.resolve(Mutation.CreateTeam, settled),
        model((next) => {
          expect(next.creation).toEqual(Submission.Submitting());
        }),
        expectOutMessage(OutMessage.FinishedMutation({ outcome })),
      );
    },
  );

  it("作り直した後に届いた成功も、application に渡す", () => {
    story(
      update,
      given(init()),
      message(Message.GotCreationMessage({ message: created })),
      expectOutMessage(createdOutcome),
    );
  });

  it("送信中でなければ作り直し、送信中なら名前と状態を残す", () => {
    const failed = update(
      named("開発"),
      Message.GotCreationMessage({ message: rejected("失敗") }),
    ).model;
    const submitting = update(
      named("開発"),
      Message.SubmittedCreateTeamForm(),
    ).model;

    expect(resetUnlessSubmitting(failed).model).toEqual(init());
    expect(resetUnlessSubmitting(submitting).model).toEqual(submitting);
  });
});

it("チームの link の hover を、そのチームの id で application に渡す", () => {
  story(
    update,
    given(init()),
    message(Message.HoveredTeamLink({ teamId: "t_1" })),
    expectOutMessage(OutMessage.HoveredTeamLink({ teamId: "t_1" })),
  );
});
