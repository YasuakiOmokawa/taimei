import { Option } from "effect";
import { AsyncData } from "foldkit";
import {
  all,
  Command,
  expect,
  expectAll,
  expectOutMessage,
  given,
  hover,
  label,
  nth,
  role,
  scene,
  submit,
  text,
  type as typeInto,
  withViewInputs,
} from "foldkit/scene";
import { describe, it } from "vitest";
import { TeamId } from "../../../../db/ids";
import { ChangedByMutation } from "../changed-by-mutation";
import * as Mutation from "../mutation";
import { init, OutMessage, update, view } from "../pages/Teams";

const DEVELOPMENT_TEAM_ID = TeamId.make("00000000-0000-4000-8000-0000000000aa");
const SALES_TEAM_ID = TeamId.make("00000000-0000-4000-8000-0000000000bb");

const TEAMS = {
  teams: [
    { id: DEVELOPMENT_TEAM_ID, name: "開発" },
    { id: SALES_TEAM_ID, name: "営業" },
  ],
};

const pageWith = withViewInputs(view, {
  canManage: true,
  teams: AsyncData.Success({ data: TEAMS }),
  teamHref: (teamId: string) => `/teams-from-application/${teamId}`,
});

const page = (...overrides: Parameters<typeof pageWith>) => ({
  update,
  view: pageWith(...overrides),
});

const nameInput = label("チーム名");
const createButton = role("button", { name: "チームを作る" });
const createForm = role("form");
const teamLinks = all.role("link");
const loading = all.role("status");
const alerts = all.role("alert");

describe("チームの一覧", () => {
  it("見出しと説明の文と、チームごとの名前の link を、application が渡した行き先で、渡された順に描く", () => {
    scene(
      page(),
      given(init()),
      expect(role("heading", { name: "チーム" })).toExist(),
      expect(
        text("チームを開くと、星取表を見て自分のレベルを記入できます"),
      ).toExist(),
      expectAll(teamLinks).toHaveCount(2),
      expect(nth(teamLinks, 0)).toHaveText("開発"),
      expect(nth(teamLinks, 0)).toHaveAttr(
        "href",
        `/teams-from-application/${DEVELOPMENT_TEAM_ID}`,
      ),
      expect(nth(teamLinks, 1)).toHaveText("営業"),
      expect(nth(teamLinks, 1)).toHaveAttr(
        "href",
        `/teams-from-application/${SALES_TEAM_ID}`,
      ),
    );
  });

  it.each([
    [
      "管理者",
      true,
      "まだチームがありません。チームを作ると、スキルを足してメンバーを割り当てられます",
    ],
    [
      "管理者でないメンバー",
      false,
      "まだどのチームにも割り当てられていません。管理者に割り当てを頼んでください",
    ],
  ])("一覧が空の時、%s にはその人への案内を描く", (_, canManage, guidance) => {
    scene(
      page({ canManage, teams: AsyncData.Success({ data: { teams: [] } }) }),
      given(init()),
      expect(text(guidance)).toExist(),
      expectAll(teamLinks).toHaveCount(0),
    );
  });

  it.each([
    ["まだ取得していない", AsyncData.Idle()],
    ["取得中", AsyncData.Loading()],
  ])(
    "%s 時は、読み込み中の文言だけを描き、form も一覧も描かない",
    (_, teams) => {
      scene(
        page({ teams }),
        given(init()),
        expectAll(loading).toHaveCount(1),
        expectAll(all.label("チーム名")).toHaveCount(0),
        expectAll(teamLinks).toHaveCount(0),
      );
    },
  );

  it("取得の失敗は、渡された文言を描き、form を描かない", () => {
    scene(
      page({
        teams: AsyncData.Failure({ error: "チームを取得できませんでした" }),
      }),
      given(init()),
      expect(text("チームを取得できませんでした")).toExist(),
      expectAll(all.label("チーム名")).toHaveCount(0),
    );
  });

  it.each([
    ["裏で取り直している間", AsyncData.Refreshing({ data: TEAMS })],
    [
      "裏の取り直しに失敗した後",
      AsyncData.Stale({ data: TEAMS, error: "チームを取得できませんでした" }),
    ],
  ])("%s は、前の一覧と form を描き続ける", (_, teams) => {
    scene(
      page({ teams }),
      given(init()),
      expectAll(teamLinks).toHaveCount(2),
      expect(nameInput).toExist(),
      expectAll(loading).toHaveCount(0),
    );
  });

  it("link に hover すると、そのチームの id を application に渡す", () => {
    scene(
      page(),
      given(init()),
      hover(nth(teamLinks, 1)),
      expectOutMessage(OutMessage.HoveredTeamLink({ teamId: SALES_TEAM_ID })),
    );
  });
});

describe("チームの作成の form", () => {
  it("管理者でなければ、form を描かず、一覧は描く", () => {
    scene(
      page({ canManage: false }),
      given(init()),
      expectAll(all.label("チーム名")).toHaveCount(0),
      expectAll(all.role("button")).toHaveCount(0),
      expectAll(teamLinks).toHaveCount(2),
    );
  });

  it("名前を入れて送信すると、応答を待つ間は button が無効になり、成功すると名前が空に戻る", () => {
    scene(
      page(),
      given(init()),
      expect(createButton).not.toBeDisabled(),
      typeInto(nameInput, "新しいチーム"),
      expect(nameInput).toHaveValue("新しいチーム"),
      submit(createForm),
      expect(createButton).toBeDisabled(),
      Command.resolve(
        Mutation.CreateTeam,
        Mutation.Message.SucceededMutation({
          changed: ChangedByMutation.TeamList(),
          maybeCreatedTeamId: Option.some("t_new"),
        }),
      ),
      expect(nameInput).toHaveValue(""),
      expect(createButton).not.toBeDisabled(),
    );
  });

  it("失敗すると、失敗の文言を alert に描き、入れた名前を残す", () => {
    scene(
      page(),
      given(init()),
      expectAll(alerts).toHaveCount(0),
      typeInto(nameInput, "開発"),
      submit(createForm),
      Command.resolve(
        Mutation.CreateTeam,
        Mutation.Message.FailedMutation({
          message: "同じ名前がすでにあります",
        }),
      ),
      expect(role("alert")).toHaveText("同じ名前がすでにあります"),
      expect(nameInput).toHaveValue("開発"),
      expect(createButton).not.toBeDisabled(),
    );
  });
});
