import { AsyncData } from "foldkit";
import type { Html, HtmlBuilder } from "foldkit/html";
import {
  all,
  expect,
  expectAll,
  given,
  nth,
  role,
  scene,
  text,
} from "foldkit/scene";
import { describe, it } from "vitest";
import { view } from "../pages/Members";

type ShownMembers = Parameters<typeof view>[0];

const page = {
  update: (model: ShownMembers, _message: never) => ({ model }),
  view: (model: ShownMembers, h: HtmlBuilder<never>): Html => view(model, h),
};

const MEMBERS = [
  { name: "山田 花子", email: "hanako@example.com", role: "OWNER" },
  { name: "佐藤 次郎", email: "jiro@example.com", role: "ADMIN" },
  { name: "鈴木 三郎", email: "saburo@example.com", role: "MEMBER" },
  { name: "田中 四郎", email: "shiro@example.com" },
] as const;

const LOADED: ShownMembers = AsyncData.Success({ data: { members: MEMBERS } });
const EMPTY: ShownMembers = AsyncData.Success({ data: { members: [] } });
const LOADING: ShownMembers = AsyncData.Loading();
const FAILED: ShownMembers = AsyncData.Failure({
  error: "メンバー一覧を取得できませんでした",
});
const REFRESHING: ShownMembers = AsyncData.Refreshing({
  data: { members: MEMBERS },
});

const DESCRIPTION =
  "事業所に所属している人です。チームへの割り当てはチームの画面で行います";
const heading = role("heading", { level: 1, name: "メンバー" });
const inviteLink = role("link", {
  name: /メンバーを招待.*\(新しいタブで開きます\)/,
});
const rows = all.selector("tbody tr");
const cells = all.selector("tbody td");
const COLUMN_COUNT = 3;
const cellOf = (row: number, column: number) =>
  nth(cells, row * COLUMN_COUNT + column);
const roleCellOf = (row: number) => cellOf(row, 2);

describe("メンバーの page", () => {
  it("見出し・説明と、taimei-auth のメンバーの画面を新しいタブで開く招待の link を描く", () => {
    scene(
      page,
      given(LOADED),
      expect(heading).toExist(),
      expect(text(DESCRIPTION)).toExist(),
      expect(inviteLink).toHaveAttr("href", "/auth/account/members"),
      expect(inviteLink).toHaveAttr("target", "_blank"),
      expect(inviteLink).toHaveAttr("rel", "noopener noreferrer"),
    );
  });

  it("メンバーごとに、名前・メールアドレス・役割の行を渡された順に描く", () => {
    scene(
      page,
      given(LOADED),
      expectAll(all.role("columnheader")).toHaveCount(COLUMN_COUNT),
      expectAll(rows).toHaveCount(MEMBERS.length),
      ...MEMBERS.flatMap((member, row) => [
        expect(cellOf(row, 0)).toHaveText(member.name),
        expect(cellOf(row, 1)).toHaveText(member.email),
      ]),
    );
  });

  it("役割は taimei-auth の画面と同じ表示名で描き、役割の無い人は「—」と描く", () => {
    scene(
      page,
      given(LOADED),
      expect(roleCellOf(0)).toHaveText("オーナー"),
      expect(roleCellOf(1)).toHaveText("管理者"),
      expect(roleCellOf(2)).toHaveText("メンバー"),
      expect(roleCellOf(3)).toHaveText("—"),
    );
  });

  it("一覧が空なら、列の見出しだけの表を描き、案内の文言を足さない", () => {
    scene(
      page,
      given(EMPTY),
      expectAll(all.role("table")).toHaveCount(1),
      expectAll(rows).toHaveCount(0),
      expectAll(all.selector("p")).toHaveCount(1),
    );
  });

  it("読み込み中は、見出しと招待の link と、読み込み中の status を描き、表を描かない", () => {
    scene(
      page,
      given(LOADING),
      expect(heading).toExist(),
      expect(inviteLink).toExist(),
      expect(role("status")).toHaveText("読み込み中…"),
      expectAll(all.role("table")).toHaveCount(0),
    );
  });

  it("取得の失敗は、見出しと招待の link と失敗の文言を描き、表を描かない", () => {
    scene(
      page,
      given(FAILED),
      expect(heading).toExist(),
      expect(inviteLink).toExist(),
      expect(text("メンバー一覧を取得できませんでした")).toExist(),
      expectAll(all.role("table")).toHaveCount(0),
    );
  });

  it("裏で取り直している間は、前の一覧を描き、読み込み中の status を描かない", () => {
    scene(
      page,
      given(REFRESHING),
      expectAll(rows).toHaveCount(MEMBERS.length),
      expectAll(all.role("status")).toHaveCount(0),
    );
  });
});
