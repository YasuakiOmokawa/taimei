import { Effect, Option, Schema } from "effect";
import { Command, type Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import { failureMessageOf } from "../shared/failure-message";
import { SpaHttpClient } from "../shared/spa-http-client";
import { Submission } from "../shared/submission";
import { ChangedByMutation, MyLevelEntry } from "./changed-by-mutation";

export const Model = Submission;
export type Model = typeof Model.Type;

const Succeeded = {
  changed: ChangedByMutation,
  maybeCreatedTeamId: Schema.Option(Schema.String),
};

export const Message = defineMessageUnion({
  SucceededMutation: Succeeded,
  FailedMutation: { message: Schema.String },
  CanceledMutation: { restored: Submission },
  RequiredSignIn: {},
  ChangedSession: {},
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  SucceededMutation: Succeeded,
  RequiredSignIn: {},
  ChangedSession: {},
});
export type OutMessage = typeof OutMessage.Type;

const CREATE_TEAM_FAILED = "チームを作れませんでした";
const SAVE_MY_LEVELS_FAILED = "保存できませんでした";
const RENAME_TEAM_FAILED = "名前を変えられませんでした";
const DELETE_TEAM_FAILED = "チームを削除できませんでした";
const ADD_SKILL_FAILED = "スキルを足せませんでした";
const REMOVE_SKILL_FAILED = "スキルを削除できませんでした";
const ASSIGN_MEMBER_FAILED = "割り当てられませんでした";
const UNASSIGN_MEMBER_FAILED = "外せませんでした";

type SpaClient = SpaHttpClient["Service"];

type MutationFailure = Effect.Error<
  ReturnType<
    | SpaClient["teamManagement"][keyof SpaClient["teamManagement"]]
    | SpaClient["myLevels"][keyof SpaClient["myLevels"]]
  >
>;

const settledBy = <Value>(
  send: Effect.Effect<Value, MutationFailure, SpaHttpClient>,
  fallbackMessage: string,
  toSucceeded: (value: Value) => ReturnType<typeof Message.SucceededMutation>,
) =>
  send.pipe(
    Effect.map(toSucceeded),
    Effect.catchTags({
      Unauthenticated: () => Effect.succeed(Message.RequiredSignIn()),
      SessionChanged: () => Effect.succeed(Message.ChangedSession()),
      HttpClientError: Effect.die,
      SchemaError: Effect.die,
    }),
    Effect.catchCause((cause) =>
      Effect.succeed(
        Message.FailedMutation({
          message: failureMessageOf(cause, fallbackMessage),
        }),
      ),
    ),
  );

const SETTLED_MESSAGES = [
  Message.SucceededMutation,
  Message.FailedMutation,
  Message.RequiredSignIn,
  Message.ChangedSession,
] as const;

const CONFIRMED_MESSAGES = [
  ...SETTLED_MESSAGES,
  Message.CanceledMutation,
] as const;

const changedTeam = (teamId: string) => () =>
  Message.SucceededMutation({
    changed: ChangedByMutation.Team({ teamId }),
    maybeCreatedTeamId: Option.none(),
  });

const RestoredOnCancel = { restoredOnCancel: Submission };

const afterConfirmation = <Settled, Requirements>(
  {
    confirmation,
    restoredOnCancel,
  }: Readonly<{ confirmation: string; restoredOnCancel: Submission }>,
  settle: Effect.Effect<Settled, never, Requirements>,
) =>
  Effect.sync(() => window.confirm(confirmation)).pipe(
    Effect.flatMap(
      (
        isConfirmed,
      ): Effect.Effect<
        Settled | ReturnType<typeof Message.CanceledMutation>,
        never,
        Requirements
      > =>
        isConfirmed
          ? settle
          : Effect.succeed(
              Message.CanceledMutation({ restored: restoredOnCancel }),
            ),
    ),
  );

export const CreateTeam = Command.define("CreateTeam", {
  args: { name: Schema.String },
  messages: SETTLED_MESSAGES,
  execute: ({ name }) =>
    settledBy(
      SpaHttpClient.use((client) =>
        client.teamManagement.create({ payload: { name } }),
      ),
      CREATE_TEAM_FAILED,
      ({ id }) =>
        Message.SucceededMutation({
          changed: ChangedByMutation.TeamList(),
          maybeCreatedTeamId: Option.some(id),
        }),
    ),
});

export const SaveMyLevelsArgs = {
  teamId: Schema.String,
  myUserId: Schema.String,
  entries: Schema.Array(MyLevelEntry),
};

export const SaveMyLevels = Command.define("SaveMyLevels", {
  args: SaveMyLevelsArgs,
  messages: SETTLED_MESSAGES,
  execute: ({ teamId, myUserId, entries }) =>
    settledBy(
      SpaHttpClient.use((client) =>
        client.myLevels.saveMyLevels({
          params: { teamId },
          payload: { levels: entries },
        }),
      ),
      SAVE_MY_LEVELS_FAILED,
      () =>
        Message.SucceededMutation({
          changed: ChangedByMutation.MyLevels({ teamId, myUserId, entries }),
          maybeCreatedTeamId: Option.none(),
        }),
    ),
});

export const RenameTeamArgs = { teamId: Schema.String, name: Schema.String };

export const RenameTeam = Command.define("RenameTeam", {
  args: RenameTeamArgs,
  messages: SETTLED_MESSAGES,
  execute: ({ teamId, name }) =>
    settledBy(
      SpaHttpClient.use((client) =>
        client.teamManagement.rename({ params: { teamId }, payload: { name } }),
      ),
      RENAME_TEAM_FAILED,
      changedTeam(teamId),
    ),
});

export const AddSkillArgs = { teamId: Schema.String, name: Schema.String };

export const AddSkill = Command.define("AddSkill", {
  args: AddSkillArgs,
  messages: SETTLED_MESSAGES,
  execute: ({ teamId, name }) =>
    settledBy(
      SpaHttpClient.use((client) =>
        client.teamManagement.addSkill({
          params: { teamId },
          payload: { name },
        }),
      ),
      ADD_SKILL_FAILED,
      changedTeam(teamId),
    ),
});

export const AssignMemberArgs = {
  teamId: Schema.String,
  userId: Schema.String,
};

export const AssignMember = Command.define("AssignMember", {
  args: AssignMemberArgs,
  messages: SETTLED_MESSAGES,
  execute: ({ teamId, userId }) =>
    settledBy(
      SpaHttpClient.use((client) =>
        client.teamManagement.assign({ params: { teamId, userId } }),
      ),
      ASSIGN_MEMBER_FAILED,
      changedTeam(teamId),
    ),
});

export const RemoveSkillArgs = {
  teamId: Schema.String,
  skillId: Schema.String,
  confirmation: Schema.String,
};

export const RemoveSkill = Command.define("RemoveSkill", {
  args: { ...RemoveSkillArgs, ...RestoredOnCancel },
  messages: CONFIRMED_MESSAGES,
  execute: ({ teamId, skillId, ...confirmed }) =>
    afterConfirmation(
      confirmed,
      settledBy(
        SpaHttpClient.use((client) =>
          client.teamManagement.removeSkill({ params: { skillId } }),
        ),
        REMOVE_SKILL_FAILED,
        changedTeam(teamId),
      ),
    ),
});

export const UnassignMemberArgs = {
  teamId: Schema.String,
  userId: Schema.String,
  confirmation: Schema.String,
};

export const UnassignMember = Command.define("UnassignMember", {
  args: { ...UnassignMemberArgs, ...RestoredOnCancel },
  messages: CONFIRMED_MESSAGES,
  execute: ({ teamId, userId, ...confirmed }) =>
    afterConfirmation(
      confirmed,
      settledBy(
        SpaHttpClient.use((client) =>
          client.teamManagement.unassign({ params: { teamId, userId } }),
        ),
        UNASSIGN_MEMBER_FAILED,
        changedTeam(teamId),
      ),
    ),
});

export const DeleteTeamArgs = {
  teamId: Schema.String,
  confirmation: Schema.String,
};

export const DeleteTeam = Command.define("DeleteTeam", {
  args: { ...DeleteTeamArgs, ...RestoredOnCancel },
  messages: CONFIRMED_MESSAGES,
  execute: ({ teamId, ...confirmed }) =>
    afterConfirmation(
      confirmed,
      settledBy(
        SpaHttpClient.use((client) =>
          client.teamManagement.delete({ params: { teamId } }),
        ),
        DELETE_TEAM_FAILED,
        () =>
          Message.SucceededMutation({
            changed: ChangedByMutation.TeamDeleted({ teamId }),
            maybeCreatedTeamId: Option.none(),
          }),
      ),
    ),
});

export const init = (): Model => Submission.Idle();

export const update = (model: Model, message: Message) =>
  Message.match<
    Update.ReturnWithOutMessage<Model, Message, OutMessage, SpaHttpClient>
  >(message, {
    SucceededMutation: ({ changed, maybeCreatedTeamId }) => ({
      model: Submission.Idle(),
      outMessage: OutMessage.SucceededMutation({ changed, maybeCreatedTeamId }),
    }),
    FailedMutation: ({ message: rejection }) => ({
      model: Submission.Rejected({ message: rejection }),
    }),
    CanceledMutation: ({ restored }) => ({ model: restored }),
    RequiredSignIn: () => ({ model, outMessage: OutMessage.RequiredSignIn() }),
    ChangedSession: () => ({ model, outMessage: OutMessage.ChangedSession() }),
  });

const submitWith = (
  model: Model,
  command: Command.Command<Message, never, SpaHttpClient>,
): Update.Return<Model, Message, SpaHttpClient> =>
  Submission.guards.Submitting(model)
    ? { model }
    : { model: Submission.Submitting(), commands: [command] };

export const submitCreateTeam = (model: Model, name: string) =>
  submitWith(model, CreateTeam({ name }));

export const submitSaveMyLevels = (
  model: Model,
  save: Schema.Struct.Type<typeof SaveMyLevelsArgs>,
) => submitWith(model, SaveMyLevels(save));

export const submitRenameTeam = (
  model: Model,
  rename: Schema.Struct.Type<typeof RenameTeamArgs>,
) => submitWith(model, RenameTeam(rename));

export const submitAddSkill = (
  model: Model,
  add: Schema.Struct.Type<typeof AddSkillArgs>,
) => submitWith(model, AddSkill(add));

export const submitAssignMember = (
  model: Model,
  assign: Schema.Struct.Type<typeof AssignMemberArgs>,
) => submitWith(model, AssignMember(assign));

export const submitRemoveSkill = (
  model: Model,
  remove: Schema.Struct.Type<typeof RemoveSkillArgs>,
) => submitWith(model, RemoveSkill({ ...remove, restoredOnCancel: model }));

export const submitUnassignMember = (
  model: Model,
  unassign: Schema.Struct.Type<typeof UnassignMemberArgs>,
) =>
  submitWith(model, UnassignMember({ ...unassign, restoredOnCancel: model }));

export const submitDeleteTeam = (
  model: Model,
  remove: Schema.Struct.Type<typeof DeleteTeamArgs>,
) => submitWith(model, DeleteTeam({ ...remove, restoredOnCancel: model }));
