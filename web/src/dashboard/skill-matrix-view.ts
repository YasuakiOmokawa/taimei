import { Array } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import { cardMessageView } from "../shared/ui/card-view";
import { levels, symbolOrBlank, UNRECORDED_MARK } from "./level";
import { sectionView } from "./section-view";
import { BIAS_RULE, type Cell, type Roster } from "./skill-matrix";

type ReadyRoster = Extract<Roster, { _tag: "MatrixReady" }>;

export const MESSAGE_WITHOUT_MATRIX: Record<
  Exclude<Roster["_tag"], "MatrixReady">,
  string
> = {
  MembersUnavailable: "メンバー一覧を取得できませんでした",
  MatrixIncomplete:
    "下のスキルを足してメンバーを割り当てると、ここに星取表が出ます",
};

const WANTS_TO_LEARN_MARK = "学";
const BIAS_LABEL = "偏り";

const recordedCellContentView = <Message>(
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

const cellView = <Message>(cell: Cell, h: HtmlBuilder<Message>): Html =>
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

const summaryRowView = <Message>(
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

const summaryRowsView = <Message>(
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

const legendView = <Message>(h: HtmlBuilder<Message>): Html =>
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

const matrixHeaderView = <Message>(
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

const memberRowView = <Message>(
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

const skillMatrixView = <Message>(
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

export const skillMatrixSectionView = <Message>(
  roster: Roster,
  h: HtmlBuilder<Message>,
): Html =>
  sectionView(
    { title: "星取表" },
    roster._tag === "MatrixReady"
      ? skillMatrixView(roster, h)
      : [cardMessageView(MESSAGE_WITHOUT_MATRIX[roster._tag], h)],
    h,
  );
