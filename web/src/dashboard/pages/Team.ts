import { Array, HashMap, Option, Schema } from "effect";
import { AsyncData, Submodel, Update } from "foldkit";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { modifyFields } from "foldkit/struct";
import { ChevronLeft } from "lucide";
import type { SpaHttpClient } from "../../shared/spa-http-client";
import { Submission } from "../../shared/submission";
import { rejectionAlertView } from "../../shared/ui/alert-text-view";
import { buttonView } from "../../shared/ui/button-view";
import {
  cardLoadingView,
  cardMessageView,
  cardView,
} from "../../shared/ui/card-view";
import { iconView } from "../../shared/ui/icon-view";
import { checkboxView, inputView } from "../../shared/ui/input-view";
import { selectView } from "../../shared/ui/select-view";
import { MyLevelEntry } from "../changed-by-mutation";
import { levelEntriesOf, levels } from "../level";
import * as Mutation from "../mutation";
import {
  BIAS_RULE,
  type Cell,
  type Member,
  type Roster,
  type TeamDetail,
  teamSkillMatrix,
  withMyLevels,
} from "../skill-matrix";
import { submitFormView } from "../submit-form-view";

const SUBMISSION_SLOTS = [
  "saving",
  "renaming",
  "deleting",
  "addingSkill",
  "removingSkill",
  "assigning",
  "unassigning",
] as const;

const SubmissionSlot = Schema.Literals(SUBMISSION_SLOTS);
type SubmissionSlot = typeof SubmissionSlot.Type;

const RenameDraft = Schema.Struct({
  value: Schema.String,
  editedFrom: Schema.String,
});

export const Model = Schema.Struct({
  levelDrafts: Schema.HashMap(Schema.String, Schema.String),
  wantsToLearnDrafts: Schema.HashMap(Schema.String, Schema.Boolean),
  pendingEntries: Schema.Array(MyLevelEntry),
  maybeRenameDraft: Schema.Option(RenameDraft),
  skillNameDraft: Schema.String,
  maybeAssigneeDraft: Schema.Option(Schema.String),
  saving: Mutation.Model,
  renaming: Mutation.Model,
  deleting: Mutation.Model,
  addingSkill: Mutation.Model,
  removingSkill: Mutation.Model,
  assigning: Mutation.Model,
  unassigning: Mutation.Model,
});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  SelectedLevel: { skillId: Schema.String, value: Schema.String },
  ToggledWantsToLearn: { skillId: Schema.String, isChecked: Schema.Boolean },
  SubmittedMyLevelsForm: Mutation.SaveMyLevelsArgs,
  UpdatedTeamName: RenameDraft.fields,
  UpdatedSkillName: { value: Schema.String },
  SelectedAssignee: { userId: Schema.String },
  SubmittedRenameForm: { teamId: Schema.String, teamName: Schema.String },
  SubmittedAddSkillForm: { teamId: Schema.String },
  SubmittedAssignForm: {
    teamId: Schema.String,
    candidateUserIds: Schema.NonEmptyArray(Schema.String),
  },
  SubmittedWhileRefreshing: {},
  ClickedRemoveSkill: Mutation.RemoveSkillArgs,
  ClickedUnassign: Mutation.UnassignMemberArgs,
  ClickedDeleteTeam: Mutation.DeleteTeamArgs,
  GotMutationMessage: { slotId: SubmissionSlot, message: Mutation.Message },
});
export type Message = typeof Message.Type;

export const OutMessage = defineMessageUnion({
  FinishedMutation: { outcome: Mutation.OutMessage },
});
export type OutMessage = typeof OutMessage.Type;

type LoadedTeam = Readonly<{
  team: TeamDetail;
  members: ReadonlyArray<Member> | null;
}>;

type ViewInputs = Readonly<{
  teamId: string;
  myUserId: string;
  canManage: boolean;
  team: AsyncData.AsyncData<LoadedTeam, string>;
  teamsHref: string;
}>;

type ReadyRoster = Extract<Roster, { _tag: "MatrixReady" }>;
type KnownRoster = Exclude<Roster, { _tag: "MembersUnavailable" }>;

const MESSAGE_WITHOUT_MATRIX: Record<
  Exclude<Roster["_tag"], "MatrixReady">,
  string
> = {
  MembersUnavailable: "メンバー一覧を取得できませんでした",
  MatrixIncomplete:
    "下のスキルを足してメンバーを割り当てると、ここに星取表が出ます",
};

const UNRECORDED_MARK = "—";
const UNRECORDED_LEVEL = "";
const WANTS_TO_LEARN_MARK = "学";
const BIAS_LABEL = "偏り";

const symbolOrBlank = (symbol: string) => symbol || "空欄";

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
  maybeRenameDraft: Option.none(),
  skillNameDraft: "",
  maybeAssigneeDraft: Option.none(),
  saving: Mutation.init(),
  renaming: Mutation.init(),
  deleting: Mutation.init(),
  addingSkill: Mutation.init(),
  removingSkill: Mutation.init(),
  assigning: Mutation.init(),
  unassigning: Mutation.init(),
});

export const isSaving = (model: Model) =>
  Submission.guards.Submitting(model.saving);

export const isSubmitting = (model: Model) =>
  Array.some(SUBMISSION_SLOTS, (slotId) =>
    Submission.guards.Submitting(model[slotId]),
  );

type Step = Update.Step<Model, Message>;

const unchanged: Step = (model) => ({ model });

const mutationChild = (slotId: SubmissionSlot) => ({
  read: (model: Model) => Option.some(model[slotId]),
  write: (model: Model, nextSubmission: Mutation.Model): Model => ({
    ...model,
    [slotId]: nextSubmission,
  }),
  toParentMessage: (message: Mutation.Message) =>
    Message.GotMutationMessage({ slotId, message }),
});

const foldSubmit = <Args>(
  slotId: SubmissionSlot,
  submit: (
    submission: Mutation.Model,
    args: Args,
  ) => Update.Return<Mutation.Model, Mutation.Message, SpaHttpClient>,
) => Update.foldChild({ ...mutationChild(slotId), update: submit });

const clearSkillNameDraft: Step = (model) => ({
  model: modifyFields(model, { skillNameDraft: () => "" }),
});

const clearAssigneeDraft: Step = (model) => ({
  model: modifyFields(model, { maybeAssigneeDraft: () => Option.none() }),
});

const AFTER_SUCCESS: Record<SubmissionSlot, Step> = {
  saving: unchanged,
  renaming: unchanged,
  deleting: unchanged,
  addingSkill: clearSkillNameDraft,
  removingSkill: unchanged,
  assigning: clearAssigneeDraft,
  unassigning: unchanged,
};

const foldSettled = (slotId: SubmissionSlot) =>
  Update.foldChild({
    ...mutationChild(slotId),
    update: Mutation.update,
    toParentOutMessage: (outcome: Mutation.OutMessage) =>
      OutMessage.FinishedMutation({ outcome }),
    foldOutMessage: Mutation.OutMessage.match<Step>({
      SucceededMutation: () => AFTER_SUCCESS[slotId],
      RequiredSignIn: () => unchanged,
      ChangedSession: () => unchanged,
    }),
  });

const shownTeamNameOf = (model: Model, teamName: string) =>
  model.maybeRenameDraft.pipe(
    Option.filter(({ editedFrom }) => editedFrom === teamName),
    Option.match({
      onNone: () => teamName,
      onSome: ({ value }) => value,
    }),
  );

const assigneeOf = (
  model: Model,
  candidateUserIds: Array.NonEmptyReadonlyArray<string>,
) =>
  model.maybeAssigneeDraft.pipe(
    Option.filter((userId) => Array.contains(candidateUserIds, userId)),
    Option.getOrElse(() => Array.headNonEmpty(candidateUserIds)),
  );

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
        : foldSubmit("saving", Mutation.submitSaveMyLevels)(
            modifyFields(model, { pendingEntries: () => entries }),
            { teamId, myUserId, entries },
          ),
    UpdatedTeamName: ({ value, editedFrom }) => ({
      model: modifyFields(model, {
        maybeRenameDraft: () => Option.some({ value, editedFrom }),
      }),
    }),
    UpdatedSkillName: ({ value }) => ({
      model: modifyFields(model, { skillNameDraft: () => value }),
    }),
    SelectedAssignee: ({ userId }) => ({
      model: modifyFields(model, {
        maybeAssigneeDraft: () => Option.some(userId),
      }),
    }),
    SubmittedRenameForm: ({ teamId, teamName }) =>
      foldSubmit("renaming", Mutation.submitRenameTeam)(model, {
        teamId,
        name: shownTeamNameOf(model, teamName),
      }),
    SubmittedAddSkillForm: ({ teamId }) =>
      foldSubmit("addingSkill", Mutation.submitAddSkill)(model, {
        teamId,
        name: model.skillNameDraft,
      }),
    SubmittedAssignForm: ({ teamId, candidateUserIds }) =>
      foldSubmit("assigning", Mutation.submitAssignMember)(model, {
        teamId,
        userId: assigneeOf(model, candidateUserIds),
      }),
    SubmittedWhileRefreshing: () => ({ model }),
    ClickedRemoveSkill: ({ teamId, skillId, confirmation }) =>
      foldSubmit("removingSkill", Mutation.submitRemoveSkill)(model, {
        teamId,
        skillId,
        confirmation,
      }),
    ClickedUnassign: ({ teamId, userId, confirmation }) =>
      foldSubmit("unassigning", Mutation.submitUnassignMember)(model, {
        teamId,
        userId,
        confirmation,
      }),
    ClickedDeleteTeam: ({ teamId, confirmation }) =>
      foldSubmit("deleting", Mutation.submitDeleteTeam)(model, {
        teamId,
        confirmation,
      }),
    GotMutationMessage: ({ slotId, message: mutationMessage }) =>
      foldSettled(slotId)(model, mutationMessage),
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

const sectionView = (
  heading: Readonly<{ title: string; description?: string }>,
  children: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
): Html =>
  cardView(
    [
      h.div(
        [h.Class("space-y-1 p-6 pb-4")],
        [
          h.h2([h.Class("font-semibold")], [heading.title]),
          ...(heading.description === undefined
            ? []
            : [
                h.p(
                  [h.Class("text-sm text-muted-foreground")],
                  [heading.description],
                ),
              ]),
        ],
      ),
      ...children,
    ],
    h,
  );

const recordedCellContentView = (
  cell: Cell,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const { symbol, label } = levels[cell.level];
  return [
    h.span(
      [h.AriaHidden(true), h.Class("inline-flex items-center gap-1")],
      [
        h.span([h.Class("font-symbol text-lg leading-none")], [symbol]),
        ...(cell.wantsToLearn
          ? [
              h.span(
                [
                  h.Class(
                    "rounded-md bg-secondary px-1.5 text-xs font-semibold",
                  ),
                ],
                [WANTS_TO_LEARN_MARK],
              ),
            ]
          : []),
      ],
    ),
    h.span(
      [h.Class("sr-only")],
      [cell.wantsToLearn ? `${label}、学びたい` : label],
    ),
  ];
};

const cellView = (cell: Cell, h: HtmlBuilder<Message>): Html =>
  h.td(
    [h.Class("px-3 py-3 text-center")],
    cell.recorded
      ? recordedCellContentView(cell, h)
      : [
          h.span(
            [h.AriaHidden(true), h.Class("text-muted-foreground")],
            [UNRECORDED_MARK],
          ),
          h.span([h.Class("sr-only")], ["未記入"]),
        ],
  );

type Summary = ReadyRoster["summaries"][number];

const summaryRowView = (
  row: Readonly<{
    label: string;
    cellClass: string;
    contentOf: (summary: Summary) => ReadonlyArray<Html | string>;
  }>,
  summaries: ReadonlyArray<Summary>,
  h: HtmlBuilder<Message>,
): Html =>
  h.tr(
    [],
    [
      h.th(
        [h.Scope("row"), h.Class("px-6 py-3 text-left font-medium")],
        [row.label],
      ),
      ...Array.map(summaries, (summary) =>
        h.keyed("td")(
          summary.skill.id,
          [h.Class(row.cellClass)],
          row.contentOf(summary),
        ),
      ),
    ],
  );

const summaryRowsView = (
  summaries: ReadonlyArray<Summary>,
  h: HtmlBuilder<Message>,
): Html =>
  h.tfoot(
    [h.Class("border-t")],
    [
      summaryRowView(
        {
          label: BIAS_LABEL,
          cellClass: "px-3 py-3 text-center",
          contentOf: ({ isBiased }) =>
            isBiased
              ? [
                  h.span(
                    [
                      h.Class(
                        "rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive",
                      ),
                    ],
                    [BIAS_LABEL],
                  ),
                ]
              : [],
        },
        summaries,
        h,
      ),
      summaryRowView(
        {
          label: "学びたい",
          cellClass: "px-3 py-3 text-center tabular-nums",
          contentOf: ({ wantsToLearnCount }) => [String(wantsToLearnCount)],
        },
        summaries,
        h,
      ),
    ],
  );

const LEGEND = [
  ...Array.map(Array.reverse(Object.values(levels)), ({ symbol, label }) => ({
    mark: symbolOrBlank(symbol),
    markClass: "font-symbol font-semibold text-foreground",
    text: label,
  })),
  ...Array.map(
    [
      { mark: UNRECORDED_MARK, text: "未記入" },
      { mark: WANTS_TO_LEARN_MARK, text: "学びたい" },
      {
        mark: BIAS_LABEL,
        text: `${levels[BIAS_RULE.atOrAboveLevel].label}以上の人が ${BIAS_RULE.atMostPeople} 人以下`,
      },
    ],
    (entry) => ({ ...entry, markClass: "font-semibold text-foreground" }),
  ),
];

const legendView = (h: HtmlBuilder<Message>): Html =>
  h.p(
    [
      h.Class(
        "flex flex-wrap gap-x-4 gap-y-1 px-6 py-4 text-xs text-muted-foreground",
      ),
    ],
    Array.map(LEGEND, ({ mark, markClass, text }) =>
      h.span([], [h.span([h.Class(markClass)], [mark]), ` ${text}`]),
    ),
  );

const matrixHeaderView = (
  summaries: ReadyRoster["summaries"],
  h: HtmlBuilder<Message>,
): Html =>
  h.thead(
    [h.Class("border-b text-muted-foreground")],
    [
      h.tr(
        [],
        [
          h.th(
            [
              h.Scope("col"),
              h.Class("min-w-48 px-6 py-3 text-left font-medium"),
            ],
            ["メンバー"],
          ),
          ...Array.map(summaries, ({ skill }) =>
            h.keyed("th")(
              skill.id,
              [
                h.Scope("col"),
                h.Class("min-w-28 px-3 py-3 text-center font-medium"),
              ],
              [skill.name],
            ),
          ),
        ],
      ),
    ],
  );

const memberRowView = (
  row: ReadyRoster["rows"][number],
  h: HtmlBuilder<Message>,
): Html =>
  h.keyed("tr")(
    row.member.userId,
    [],
    [
      h.th(
        [h.Scope("row"), h.Class("px-6 py-3 text-left font-normal")],
        [row.member.name],
      ),
      ...Array.map(row.cells, (cell) => cellView(cell, h)),
    ],
  );

const skillMatrixView = (
  roster: ReadyRoster,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  h.div(
    [h.Class("overflow-x-auto border-y")],
    [
      h.table(
        [h.Class("whitespace-nowrap text-sm")],
        [
          matrixHeaderView(roster.summaries, h),
          h.tbody(
            [h.Class("divide-y")],
            Array.map(roster.rows, (row) => memberRowView(row, h)),
          ),
          summaryRowsView(roster.summaries, h),
        ],
      ),
    ],
  ),
  legendView(h),
];

const matrixSectionView = (roster: Roster, h: HtmlBuilder<Message>): Html =>
  sectionView(
    { title: "星取表" },
    roster._tag === "MatrixReady"
      ? skillMatrixView(roster, h)
      : [cardMessageView(MESSAGE_WITHOUT_MATRIX[roster._tag], h)],
    h,
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

const myLevelsSectionView = (
  model: Model,
  myCells: Array.NonEmptyReadonlyArray<Cell>,
  viewInputs: ViewInputs,
  h: HtmlBuilder<Message>,
): Html =>
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
              teamId: viewInputs.teamId,
              myUserId: viewInputs.myUserId,
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
  );

type NamedItem = Readonly<{
  key: string;
  name: string;
  actions: ReadonlyArray<Html>;
}>;

const namedItemsView = (
  items: ReadonlyArray<NamedItem>,
  h: HtmlBuilder<Message>,
): Html =>
  h.ul(
    [h.Class("divide-y border-t")],
    Array.map(items, ({ key, name, actions }) =>
      h.keyed("li")(
        key,
        [
          h.Class(
            "flex min-h-12 items-center justify-between gap-4 px-6 py-3 text-sm",
          ),
        ],
        [h.span([h.Class("min-w-0 break-words")], [name]), ...actions],
      ),
    ),
  );

const namedItemsOrMessageView = (
  items: ReadonlyArray<NamedItem>,
  emptyMessage: string,
  h: HtmlBuilder<Message>,
): Html =>
  Array.match(items, {
    onEmpty: () => cardMessageView(emptyMessage, h),
    onNonEmpty: (nonEmptyItems) => namedItemsView(nonEmptyItems, h),
  });

const destructiveButtonView = (
  config: Readonly<{
    label: string;
    accessibleName?: string;
    submission: Mutation.Model;
    isBlocked: boolean;
    onClick: Message;
  }>,
  h: HtmlBuilder<Message>,
): Html =>
  buttonView({ look: "destructiveOutlineSmall", type: "button", ...config }, h);

const managementFooterView = (
  children: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
) => h.div([h.Class("space-y-2 border-t px-6 py-4")], children);

type Management = Readonly<{
  teamId: string;
  isBlocked: boolean;
}>;

const submitUnlessBlocked = (isBlocked: boolean, submitted: Message) =>
  isBlocked ? Message.SubmittedWhileRefreshing() : submitted;

const removeSkillConfirmation = (skillName: string) =>
  `スキル「${skillName}」を削除します。このスキルに記入したレベルも消え、元に戻せません。`;

const unassignConfirmation = (name: string) =>
  `${name} をこのチームから外します。このチームに記入したレベルも消え、元に戻せません。`;

const deleteTeamConfirmation = (teamName: string) =>
  `「${teamName}」を削除します。スキル・割り当て・記入したレベルも消え、元に戻せません。`;

const skillFooterView = (
  model: Model,
  { teamId, isBlocked }: Management,
  h: HtmlBuilder<Message>,
): Html =>
  managementFooterView(
    [
      ...rejectionAlertView(model.removingSkill, h),
      submitFormView(
        {
          control: inputView(
            {
              id: "add-skill-name",
              label: "スキル名",
              value: model.skillNameDraft,
              onInput: (value) => Message.UpdatedSkillName({ value }),
            },
            h,
          ),
          submitLabel: "スキルを足す",
          submission: model.addingSkill,
          isBlocked,
          onSubmit: submitUnlessBlocked(
            isBlocked,
            Message.SubmittedAddSkillForm({ teamId }),
          ),
        },
        h,
      ),
    ],
    h,
  );

const skillsSectionView = (
  model: Model,
  skills: TeamDetail["skills"],
  maybeManagement: Option.Option<Management>,
  h: HtmlBuilder<Message>,
): Html =>
  sectionView(
    { title: "スキル", description: "星取表の列になります" },
    [
      namedItemsOrMessageView(
        Array.map(skills, (skill) => ({
          key: skill.id,
          name: skill.name,
          actions: Array.fromOption(
            Option.map(maybeManagement, ({ teamId, isBlocked }) =>
              destructiveButtonView(
                {
                  label: "削除",
                  accessibleName: `${skill.name} を削除`,
                  submission: model.removingSkill,
                  isBlocked,
                  onClick: Message.ClickedRemoveSkill({
                    teamId,
                    skillId: skill.id,
                    confirmation: removeSkillConfirmation(skill.name),
                  }),
                },
                h,
              ),
            ),
          ),
        })),
        "スキルがありません",
        h,
      ),
      ...Array.fromOption(
        Option.map(maybeManagement, (management) =>
          skillFooterView(model, management, h),
        ),
      ),
    ],
    h,
  );

const assignFormView = (
  model: Model,
  candidates: Array.NonEmptyReadonlyArray<Member>,
  { teamId, isBlocked }: Management,
  h: HtmlBuilder<Message>,
): Html => {
  const candidateUserIds = Array.map(candidates, ({ userId }) => userId);
  const assignee = assigneeOf(model, candidateUserIds);
  return submitFormView(
    {
      control: selectView(
        {
          id: "assignee",
          label: "割り当てるメンバー",
          value: assignee,
          options: Array.map(candidates, ({ userId, name }) => ({
            value: userId,
            label: name,
          })),
          onChange: (userId) => Message.SelectedAssignee({ userId }),
          look: "field",
        },
        h,
      ),
      submitLabel: "割り当てる",
      submission: model.assigning,
      isBlocked,
      onSubmit: submitUnlessBlocked(
        isBlocked,
        Message.SubmittedAssignForm({ teamId, candidateUserIds }),
      ),
    },
    h,
  );
};

const assignedItemOf = (
  model: Model,
  userId: string,
  name: string,
  maybeManagement: Option.Option<Management>,
  h: HtmlBuilder<Message>,
): NamedItem => ({
  key: userId,
  name,
  actions: Array.fromOption(
    Option.map(maybeManagement, ({ teamId, isBlocked }) =>
      destructiveButtonView(
        {
          label: "外す",
          accessibleName: `${name} を外す`,
          submission: model.unassigning,
          isBlocked,
          onClick: Message.ClickedUnassign({
            teamId,
            userId,
            confirmation: unassignConfirmation(name),
          }),
        },
        h,
      ),
    ),
  ),
});

const departedAssignmentsView = (
  model: Model,
  departedUserIds: ReadonlyArray<string>,
  management: Management,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> =>
  Array.match(departedUserIds, {
    onEmpty: () => [],
    onNonEmpty: (userIds) => [
      h.h3(
        [h.Class("border-t px-6 pt-4 pb-2 text-sm font-medium")],
        ["事業所にいない人の割り当て"],
      ),
      namedItemsView(
        Array.map(userIds, (userId) =>
          assignedItemOf(model, userId, userId, Option.some(management), h),
        ),
        h,
      ),
    ],
  });

const assignmentFooterView = (
  model: Model,
  candidates: ReadonlyArray<Member>,
  management: Management,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => {
  const footer = [
    ...rejectionAlertView(model.unassigning, h),
    ...Array.match(candidates, {
      onEmpty: () => [],
      onNonEmpty: (nonEmptyCandidates) => [
        assignFormView(model, nonEmptyCandidates, management, h),
      ],
    }),
  ];
  return Array.match(footer, {
    onEmpty: () => [],
    onNonEmpty: (children) => [managementFooterView(children, h)],
  });
};

const knownAssignmentsView = (
  model: Model,
  roster: KnownRoster,
  maybeManagement: Option.Option<Management>,
  h: HtmlBuilder<Message>,
): ReadonlyArray<Html> => [
  namedItemsOrMessageView(
    Array.map(roster.assigned, ({ userId, name }) =>
      assignedItemOf(model, userId, name, maybeManagement, h),
    ),
    "割り当てたメンバーがいません",
    h,
  ),
  ...Option.match(maybeManagement, {
    onNone: () => [],
    onSome: (management) => [
      ...departedAssignmentsView(model, roster.departedUserIds, management, h),
      ...assignmentFooterView(model, roster.candidates, management, h),
    ],
  }),
];

const assignmentsSectionView = (
  model: Model,
  roster: Roster,
  maybeManagement: Option.Option<Management>,
  h: HtmlBuilder<Message>,
): Html =>
  sectionView(
    { title: "割り当てたメンバー", description: "星取表の行になります" },
    roster._tag === "MembersUnavailable"
      ? [cardMessageView(MESSAGE_WITHOUT_MATRIX.MembersUnavailable, h)]
      : knownAssignmentsView(model, roster, maybeManagement, h),
    h,
  );

const teamDeletionView = (
  model: Model,
  teamName: string,
  { teamId, isBlocked }: Management,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [
      h.Class(
        "flex flex-wrap items-center justify-between gap-4 border-t px-6 py-4",
      ),
    ],
    [
      h.p(
        [h.Class("text-sm text-muted-foreground")],
        ["チームを削除すると、スキル・割り当て・記入したレベルも消えます"],
      ),
      h.div(
        [h.Class("flex flex-wrap items-center gap-x-4 gap-y-2")],
        [
          ...rejectionAlertView(model.deleting, h),
          destructiveButtonView(
            {
              label: "チームを削除",
              submission: model.deleting,
              isBlocked,
              onClick: Message.ClickedDeleteTeam({
                teamId,
                confirmation: deleteTeamConfirmation(teamName),
              }),
            },
            h,
          ),
        ],
      ),
    ],
  );

const teamNameSectionView = (
  model: Model,
  teamName: string,
  management: Management,
  h: HtmlBuilder<Message>,
): Html => {
  const { teamId, isBlocked } = management;
  const shownTeamName = shownTeamNameOf(model, teamName);
  return sectionView(
    { title: "チーム名" },
    [
      h.div(
        [h.Class("px-6 pb-6")],
        [
          submitFormView(
            {
              control: inputView(
                {
                  id: "rename-team-name",
                  label: "チーム名",
                  value: shownTeamName,
                  onInput: (value) =>
                    Message.UpdatedTeamName({ value, editedFrom: teamName }),
                },
                h,
              ),
              submitLabel: "名前を変える",
              submission: model.renaming,
              isBlocked,
              onSubmit: submitUnlessBlocked(
                isBlocked,
                Message.SubmittedRenameForm({ teamId, teamName }),
              ),
            },
            h,
          ),
        ],
      ),
      teamDeletionView(model, teamName, management, h),
    ],
    h,
  );
};

const teamFrameView = (
  teamsHref: string,
  maybeTitle: Option.Option<string>,
  children: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class("space-y-6")],
    [
      h.div(
        [h.Class("space-y-2")],
        [
          h.a(
            [
              h.Href(teamsHref),
              h.Class(
                "inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground",
              ),
            ],
            [iconView(ChevronLeft, [h.Class("size-4")], h), "チーム"],
          ),
          ...Option.match(maybeTitle, {
            onNone: () => [],
            onSome: (title) => [
              h.h1([h.Class("text-2xl font-semibold")], [title]),
            ],
          }),
        ],
      ),
      ...children,
    ],
  );

const loadedTeamView = (
  model: Model,
  loaded: LoadedTeam,
  viewInputs: ViewInputs,
  h: HtmlBuilder<Message>,
): Html => {
  const team = isSaving(model)
    ? withMyLevels(loaded.team, viewInputs.myUserId, model.pendingEntries)
    : loaded.team;
  const { myCells, roster } = teamSkillMatrix(
    team,
    loaded.members,
    viewInputs.myUserId,
  );
  const maybeManagement = viewInputs.canManage
    ? Option.some({
        teamId: viewInputs.teamId,
        isBlocked: AsyncData.isPending(viewInputs.team),
      })
    : Option.none();
  return teamFrameView(
    viewInputs.teamsHref,
    Option.some(team.name),
    [
      matrixSectionView(roster, h),
      ...Array.match(myCells, {
        onEmpty: () => [],
        onNonEmpty: (cells) => [
          myLevelsSectionView(model, cells, viewInputs, h),
        ],
      }),
      h.keyed("div")(
        "skills-and-assignments",
        [h.Class("grid items-start gap-6 lg:grid-cols-2")],
        [
          skillsSectionView(model, team.skills, maybeManagement, h),
          assignmentsSectionView(model, roster, maybeManagement, h),
        ],
      ),
      ...Array.fromOption(
        Option.map(maybeManagement, (management) =>
          teamNameSectionView(model, team.name, management, h),
        ),
      ),
    ],
    h,
  );
};

export const view = Submodel.defineView<Model, Message, ViewInputs>(
  (model, viewInputs, h) => {
    const untitledCardView = (content: Html) =>
      teamFrameView(
        viewInputs.teamsHref,
        Option.none(),
        [cardView([content], h)],
        h,
      );
    return AsyncData.matchData(viewInputs.team, {
      onEmpty: () => untitledCardView(cardLoadingView(h)),
      onFailure: (failureMessage) =>
        untitledCardView(cardMessageView(failureMessage, h)),
      onData: (loaded) => loadedTeamView(model, loaded, viewInputs, h),
    });
  },
);
