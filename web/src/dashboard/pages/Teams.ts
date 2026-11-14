import { Array, Option, Schema } from "effect";
import { AsyncData, Submodel, Update } from "foldkit";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { modifyFields } from "foldkit/struct";
import type { Team } from "../../../../src/spa-contract";
import type { SpaHttpClient } from "../../shared/spa-http-client";
import { Submission } from "../../shared/submission";
import {
  cardLoadingView,
  cardMessageView,
  cardView,
} from "../../shared/ui/card-view";
import { inputView } from "../../shared/ui/input-view";
import * as Mutation from "../mutation";
import { submitFormView } from "../submit-form-view";

export const Model = Schema.Struct({
  nameDraft: Schema.String,
  creation: Mutation.Model,
});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  UpdatedTeamName: { value: Schema.String },
  SubmittedCreateTeamForm: {},
  GotCreationMessage: { message: Mutation.Message },
  HoveredTeamLink: { teamId: Schema.String },
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  FinishedMutation: { outcome: Mutation.OutMessage },
  HoveredTeamLink: { teamId: Schema.String },
});
export type OutMessage = typeof OutMessage.Type;

type ViewInputs = Readonly<{
  canManage: boolean;
  teams: AsyncData.AsyncData<
    Readonly<{ teams: ReadonlyArray<typeof Team.Type> }>,
    string
  >;
  teamHref: (teamId: string) => string;
}>;

const TEAM_NAME_INPUT_ID = "create-team-name";
const NO_TEAMS_FOR_MANAGER =
  "まだチームがありません。チームを作ると、スキルを足してメンバーを割り当てられます";
const NO_TEAMS_FOR_MEMBER =
  "まだどのチームにも割り当てられていません。管理者に割り当てを頼んでください";

export const init = (): Model => ({
  nameDraft: "",
  creation: Mutation.init(),
});

export const resetUnlessSubmitting = (
  model: Model,
): Update.Return<Model, Message> => ({
  model: Submission.guards.Submitting(model.creation) ? model : init(),
});

const creationChild = {
  read: (model: Model) => Option.some(model.creation),
  write: (model: Model, nextCreation: Mutation.Model): Model =>
    modifyFields(model, { creation: () => nextCreation }),
  toParentMessage: (message: Mutation.Message) =>
    Message.GotCreationMessage({ message }),
};

const foldCreationSubmit = Update.foldChild({
  ...creationChild,
  update: Mutation.submitCreateTeam,
});

const unchanged: Update.Step<Model, Message> = (model) => ({ model });

const foldCreationOutMessage = Mutation.OutMessage.match<
  Update.Step<Model, Message>
>({
  SucceededMutation: () => (model) => ({
    model: modifyFields(model, { nameDraft: () => "" }),
  }),
  RequiredSignIn: () => unchanged,
  ChangedSession: () => unchanged,
});

const foldCreation = Update.foldChild({
  ...creationChild,
  update: Mutation.update,
  toParentOutMessage: (outcome: Mutation.OutMessage) =>
    OutMessage.FinishedMutation({ outcome }),
  foldOutMessage: foldCreationOutMessage,
});

export const update = (model: Model, message: Message) =>
  Message.match<
    Update.ReturnWithOutMessage<Model, Message, OutMessage, SpaHttpClient>
  >(message, {
    UpdatedTeamName: ({ value }) => ({
      model: modifyFields(model, { nameDraft: () => value }),
    }),
    SubmittedCreateTeamForm: () => foldCreationSubmit(model, model.nameDraft),
    GotCreationMessage: ({ message: creationMessage }) =>
      foldCreation(model, creationMessage),
    HoveredTeamLink: ({ teamId }) => ({
      model,
      outMessage: OutMessage.HoveredTeamLink({ teamId }),
    }),
  });

const createTeamFormView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("border-b p-6")],
    [
      submitFormView(
        {
          control: inputView(
            {
              id: TEAM_NAME_INPUT_ID,
              label: "チーム名",
              value: model.nameDraft,
              onInput: (value) => Message.UpdatedTeamName({ value }),
            },
            h,
          ),
          submitLabel: "チームを作る",
          submission: model.creation,
          isBlocked: false,
          onSubmit: Message.SubmittedCreateTeamForm(),
        },
        h,
      ),
    ],
  );

const teamListView = (
  teams: ReadonlyArray<typeof Team.Type>,
  viewInputs: ViewInputs,
  h: HtmlBuilder<Message>,
): Html =>
  Array.match(teams, {
    onEmpty: () =>
      cardMessageView(
        viewInputs.canManage ? NO_TEAMS_FOR_MANAGER : NO_TEAMS_FOR_MEMBER,
        h,
      ),
    onNonEmpty: (listedTeams) =>
      h.ul(
        [h.Class("divide-y")],
        Array.map(listedTeams, (team) =>
          h.keyed("li")(
            team.id,
            [],
            [
              h.a(
                [
                  h.Href(viewInputs.teamHref(team.id)),
                  h.Class(
                    "block px-6 py-4 text-sm font-medium hover:bg-muted/50",
                  ),
                  h.OnMouseEnter(Message.HoveredTeamLink({ teamId: team.id })),
                ],
                [team.name],
              ),
            ],
          ),
        ),
      ),
  });

export const view = Submodel.defineView<Model, Message, ViewInputs>(
  (model, viewInputs, h) =>
    h.div(
      [h.Class("space-y-6")],
      [
        h.div(
          [h.Class("space-y-1")],
          [
            h.h1([h.Class("text-2xl font-semibold")], ["チーム"]),
            h.p(
              [h.Class("text-sm text-muted-foreground")],
              ["チームを開くと、星取表を見て自分のレベルを記入できます"],
            ),
          ],
        ),
        cardView(
          AsyncData.matchData(viewInputs.teams, {
            onEmpty: () => [cardLoadingView(h)],
            onFailure: (failureMessage) => [cardMessageView(failureMessage, h)],
            onData: ({ teams }) => [
              viewInputs.canManage ? createTeamFormView(model, h) : h.empty,
              teamListView(teams, viewInputs, h),
            ],
          }),
          h,
        ),
      ],
    ),
);
