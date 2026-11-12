import { Effect, Option, Schema } from "effect";
import { Command, type Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import { failureMessageOf } from "../shared/failure-message";
import { SpaHttpClient } from "../shared/spa-http-client";
import { Submission } from "../shared/submission";
import { ChangedByMutation } from "./changed-by-mutation";

export const Model = Submission;
export type Model = typeof Model.Type;

const Succeeded = {
  changed: ChangedByMutation,
  maybeCreatedTeamId: Schema.Option(Schema.String),
};

export const Message = defineMessageUnion({
  SucceededMutation: Succeeded,
  FailedMutation: { message: Schema.String },
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
  toSucceeded: (value: Value) => Message,
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

export const CreateTeam = Command.define("CreateTeam", {
  args: { name: Schema.String },
  messages: [
    Message.SucceededMutation,
    Message.FailedMutation,
    Message.RequiredSignIn,
    Message.ChangedSession,
  ],
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
