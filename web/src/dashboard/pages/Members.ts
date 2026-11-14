import { Array, Schema } from "effect";
import { AsyncData } from "foldkit";
import type { Html, HtmlBuilder } from "foldkit/html";
import { newTabButtonLinkView } from "../../shared/ui/button-view";
import {
  cardLoadingView,
  cardMessageView,
  cardView,
} from "../../shared/ui/card-view";

const Role = Schema.Literals(["OWNER", "ADMIN", "MEMBER"]);
type Role = typeof Role.Type;

const Member = Schema.Struct({
  name: Schema.String,
  email: Schema.String,
  role: Schema.optionalKey(Role),
});
type Member = typeof Member.Type;

export const MemberList = Schema.Struct({ members: Schema.Array(Member) });
export type MemberList = typeof MemberList.Type;

const ROLE_LABEL_OF_TAIMEI_AUTH: Record<Role, string> = {
  OWNER: "オーナー",
  ADMIN: "管理者",
  MEMBER: "メンバー",
};

const INVITE_PATH = "/auth/account/members";
const NO_ROLE = "—";

const memberRowView = <Message>(member: Member, h: HtmlBuilder<Message>) =>
  h.keyed("tr")(
    member.email,
    [],
    [
      h.td([h.Class("px-6 py-4 font-medium")], [member.name]),
      h.td([h.Class("py-4 text-muted-foreground")], [member.email]),
      h.td(
        [h.Class("px-6 py-4")],
        [
          member.role === undefined
            ? NO_ROLE
            : ROLE_LABEL_OF_TAIMEI_AUTH[member.role],
        ],
      ),
    ],
  );

const columnHeaderView = <Message>(
  label: string,
  className: string,
  h: HtmlBuilder<Message>,
) => h.th([h.Scope("col"), h.Class(className)], [label]);

const memberTableView = <Message>(
  members: ReadonlyArray<Member>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class("overflow-x-auto")],
    [
      h.table(
        [h.Class("w-full whitespace-nowrap text-sm")],
        [
          h.thead(
            [h.Class("border-b text-left text-muted-foreground")],
            [
              h.tr(
                [],
                [
                  columnHeaderView("名前", "px-6 py-3 font-medium", h),
                  columnHeaderView("メールアドレス", "py-3 font-medium", h),
                  columnHeaderView("役割", "px-6 py-3 font-medium", h),
                ],
              ),
            ],
          ),
          h.tbody(
            [h.Class("divide-y")],
            Array.map(members, (member) => memberRowView(member, h)),
          ),
        ],
      ),
    ],
  );

export const view = <Message>(
  memberList: AsyncData.AsyncData<MemberList, string>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class("space-y-6")],
    [
      h.div(
        [h.Class("flex flex-wrap items-end justify-between gap-4")],
        [
          h.div(
            [h.Class("space-y-1")],
            [
              h.h1([h.Class("text-2xl font-semibold")], ["メンバー"]),
              h.p(
                [h.Class("text-sm text-muted-foreground")],
                [
                  "事業所に所属している人です。チームへの割り当てはチームの画面で行います",
                ],
              ),
            ],
          ),
          newTabButtonLinkView(
            { label: "メンバーを招待", href: INVITE_PATH },
            h,
          ),
        ],
      ),
      cardView(
        [
          AsyncData.matchData(memberList, {
            onEmpty: () => cardLoadingView(h),
            onFailure: (failureMessage) => cardMessageView(failureMessage, h),
            onData: ({ members }) => memberTableView(members, h),
          }),
        ],
        h,
      ),
    ],
  );
