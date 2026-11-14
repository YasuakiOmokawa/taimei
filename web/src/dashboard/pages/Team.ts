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
import { checkboxView } from "../../shared/ui/input-view";
import { selectView } from "../../shared/ui/select-view";
import { MyLevelEntry } from "../changed-by-mutation";
import {
  levelEntriesOf,
  levelFieldName,
  levels,
  wantsToLearnFieldName,
} from "../level";
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

export const Model = Schema.Struct({
  levelDrafts: Schema.HashMap(Schema.String, Schema.String),
  wantsToLearnDrafts: Schema.HashMap(Schema.String, Schema.Boolean),
  pendingEntries: Schema.Array(MyLevelEntry),
  saving: Mutation.Model,
});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  SelectedLevel: { skillId: Schema.String, value: Schema.String },
  ToggledWantsToLearn: { skillId: Schema.String, isChecked: Schema.Boolean },
  SubmittedMyLevelsForm: Mutation.SaveMyLevelsArgs,
  GotSaveMessage: { message: Mutation.Message },
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
  team: AsyncData.AsyncData<LoadedTeam, string>;
  teamsHref: string;
}>;

type ReadyRoster = Extract<Roster, { _tag: "MatrixReady" }>;

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
  saving: Mutation.init(),
});

export const isSaving = (model: Model) =>
  Submission.guards.Submitting(model.saving);

const savingChild = {
  read: (model: Model) => Option.some(model.saving),
  write: (model: Model, nextSaving: Mutation.Model): Model =>
    modifyFields(model, { saving: () => nextSaving }),
  toParentMessage: (message: Mutation.Message) =>
    Message.GotSaveMessage({ message }),
};

const foldSaveSubmit = Update.foldChild({
  ...savingChild,
  update: Mutation.submitSaveMyLevels,
});

const foldSave = Update.foldChild({
  ...savingChild,
  update: Mutation.update,
  toParentOutMessage: (outcome: Mutation.OutMessage) =>
    OutMessage.FinishedMutation({ outcome }),
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
        : foldSaveSubmit(
            modifyFields(model, { pendingEntries: () => entries }),
            { teamId, myUserId, entries },
          ),
    GotSaveMessage: ({ message: saveMessage }) => foldSave(model, saveMessage),
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

const formFieldsOf = (model: Model, cell: Cell) => [
  [levelFieldName(cell.skill.id), shownLevelOf(model, cell)] as const,
  ...(shownWantsToLearnOf(model, cell)
    ? [[wantsToLearnFieldName(cell.skill.id), "on"] as const]
    : []),
];

const entriesOf = (model: Model, cells: ReadonlyArray<Cell>) =>
  levelEntriesOf(
    cells,
    Array.reduce(
      Array.flatMap(cells, (cell) => formFieldsOf(model, cell)),
      new FormData(),
      (form, [name, value]) => {
        form.set(name, value);
        return form;
      },
    ),
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
