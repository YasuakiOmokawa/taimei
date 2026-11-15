import { Array, HashMap, Option, Schema } from "effect";
import { Submodel, Update } from "foldkit";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { modifyFields } from "foldkit/struct";
import { SkillLevel } from "../../../src/spa-contract";
import type { SpaHttpClient } from "../shared/spa-http-client";
import { Submission } from "../shared/submission";
import { rejectionAlertView } from "../shared/ui/alert-text-view";
import { buttonView } from "../shared/ui/button-view";
import { checkboxView } from "../shared/ui/input-view";
import { selectView } from "../shared/ui/select-view";
import {
  levelEntriesOf,
  levels,
  symbolOrBlank,
  UNRECORDED_MARK,
} from "./level";
import * as Mutation from "./mutation";
import { sectionView } from "./section-view";
import { type Cell, type TeamDetail, withMyLevels } from "./skill-matrix";

export const Model = Schema.Struct({
  levelDrafts: Schema.HashMap(Schema.String, Schema.String),
  wantsToLearnDrafts: Schema.HashMap(Schema.String, Schema.Boolean),
  pendingEntries: Schema.Array(SkillLevel),
  saving: Mutation.Model,
});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  SelectedLevel: { skillId: Schema.String, value: Schema.String },
  ToggledWantsToLearn: { skillId: Schema.String, isChecked: Schema.Boolean },
  SubmittedMyLevelsForm: Mutation.SaveMyLevelsArgs,
  GotMutationMessage: { message: Mutation.Message },
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  FinishedMutation: { outcome: Mutation.OutMessage },
});
export type OutMessage = typeof OutMessage.Type;

type ViewInputs = Readonly<{
  teamId: string;
  myUserId: string;
  myCells: Array.NonEmptyReadonlyArray<Cell>;
}>;

const UNRECORDED_LEVEL = "";

const LEVEL_OPTIONS = Array.map(
  Object.entries(levels),
  ([level, { symbol, label }]) => ({
    value: level,
    label: `${symbolOrBlank(symbol)}: ${label}`,
  }),
);

const OPTIONS_OF_UNRECORDED = [
  { value: UNRECORDED_LEVEL, label: `${UNRECORDED_MARK}: 未記入` },
  ...LEVEL_OPTIONS,
];

const levelOptionsOf = (cell: Cell) =>
  cell.recorded ? LEVEL_OPTIONS : OPTIONS_OF_UNRECORDED;

export const init = (): Model => ({
  levelDrafts: HashMap.empty(),
  wantsToLearnDrafts: HashMap.empty(),
  pendingEntries: [],
  saving: Mutation.init(),
});

export const isSaving = (model: Model) =>
  Submission.guards.Submitting(model.saving);

export const teamWithPendingLevels = (
  model: Model,
  team: TeamDetail,
  myUserId: string,
): TeamDetail =>
  isSaving(model) ? withMyLevels(team, myUserId, model.pendingEntries) : team;

type Step = Update.Step<Model, Message>;

const unchanged: Step = (model) => ({ model });

const savingChild = {
  read: (model: Model) => Option.some(model.saving),
  write: (model: Model, nextSaving: Mutation.Model) =>
    modifyFields(model, { saving: () => nextSaving }),
  toParentMessage: (message: Mutation.Message) =>
    Message.GotMutationMessage({ message }),
};

const foldSave = Update.foldChild({
  ...savingChild,
  update: Mutation.submitSaveMyLevels,
});

const foldSettled = Update.foldChild({
  ...savingChild,
  update: Mutation.update,
  toParentOutMessage: (outcome: Mutation.OutMessage) =>
    OutMessage.FinishedMutation({ outcome }),
  foldOutMessage: Mutation.OutMessage.match<Step>({
    SucceededMutation: () => unchanged,
    RequiredSignIn: () => unchanged,
    ChangedSession: () => unchanged,
  }),
});

export const update = (model: Model, message: Message) =>
  Message.match<
    Update.ReturnWithOutMessage<Model, Message, OutMessage, SpaHttpClient>
  >(message, {
    SelectedLevel: ({ skillId, value }) => ({
      model: modifyFields(model, {
        levelDrafts: HashMap.set(skillId, value),
      }),
    }),
    ToggledWantsToLearn: ({ skillId, isChecked }) => ({
      model: modifyFields(model, {
        wantsToLearnDrafts: HashMap.set(skillId, isChecked),
      }),
    }),
    SubmittedMyLevelsForm: ({ teamId, myUserId, entries }) =>
      isSaving(model)
        ? { model }
        : foldSave(modifyFields(model, { pendingEntries: () => entries }), {
            teamId,
            myUserId,
            entries,
          }),
    GotMutationMessage: ({ message: mutationMessage }) =>
      foldSettled(model, mutationMessage),
  });

const shownLevelOf = (model: Model, cell: Cell) =>
  HashMap.get(model.levelDrafts, cell.skill.id).pipe(
    Option.filter((draft) =>
      Array.some(levelOptionsOf(cell), (option) => option.value === draft),
    ),
    Option.getOrElse(() =>
      cell.recorded ? String(cell.level) : UNRECORDED_LEVEL,
    ),
  );

const shownWantsToLearnOf = (model: Model, cell: Cell) =>
  Option.getOrElse(
    HashMap.get(model.wantsToLearnDrafts, cell.skill.id),
    () => cell.wantsToLearn,
  );

const entriesOf = (model: Model, cells: ReadonlyArray<Cell>) =>
  levelEntriesOf(
    cells,
    (cell) => shownLevelOf(model, cell),
    (cell) => shownWantsToLearnOf(model, cell),
  );

const myLevelRowView = (
  model: Model,
  cell: Cell,
  h: HtmlBuilder<Message>,
): Html =>
  h.keyed("li")(
    cell.skill.id,
    [
      h.Class(
        "flex min-h-14 flex-wrap items-center gap-x-6 gap-y-2 py-2 text-sm",
      ),
    ],
    [
      h.span([h.Class("min-w-32 font-medium")], [cell.skill.name]),
      selectView(
        {
          id: `my-level-${cell.skill.id}`,
          label: `${cell.skill.name} のレベル`,
          value: shownLevelOf(model, cell),
          options: levelOptionsOf(cell),
          onChange: (value) =>
            Message.SelectedLevel({ skillId: cell.skill.id, value }),
          look: "levelSymbol",
        },
        h,
      ),
      checkboxView(
        {
          id: `wants-to-learn-${cell.skill.id}`,
          label: "学びたい",
          accessibleName: `${cell.skill.name} を学びたい`,
          isChecked: shownWantsToLearnOf(model, cell),
          onToggle: (isChecked) =>
            Message.ToggledWantsToLearn({ skillId: cell.skill.id, isChecked }),
        },
        h,
      ),
    ],
  );

const saveFooterView = (
  saving: Mutation.Model,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class("flex flex-wrap items-center gap-x-4 gap-y-2")],
    [
      buttonView(
        {
          look: "primarySmall",
          type: "submit",
          label: "保存",
          submission: saving,
          isBlocked: false,
        },
        h,
      ),
      ...rejectionAlertView(saving, h),
    ],
  );

export const view = Submodel.defineView<Model, Message, ViewInputs>(
  (model, { teamId, myUserId, myCells }, h) =>
    sectionView(
      {
        title: "自分のレベル",
        description: "記入すると星取表の自分の行に出ます",
      },
      [
        h.form(
          [
            h.Class("space-y-4 px-6 pb-6"),
            h.OnSubmit(
              Message.SubmittedMyLevelsForm({
                teamId,
                myUserId,
                entries: entriesOf(model, myCells),
              }),
            ),
          ],
          [
            h.ul(
              [h.Class("divide-y border-y")],
              Array.map(myCells, (cell) => myLevelRowView(model, cell, h)),
            ),
            saveFooterView(model.saving, h),
          ],
        ),
      ],
      h,
    ),
);
