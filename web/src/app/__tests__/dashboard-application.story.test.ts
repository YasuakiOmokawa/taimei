import { type Effect, HashMap, ManagedRuntime, Option, Result } from "effect";
import { AsyncData } from "foldkit";
import { UrlRequest } from "foldkit/navigation";
import { Command, given, message, model, story } from "foldkit/story";
import { fromString } from "foldkit/url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SkillId, TeamId } from "../../../../db/ids";
import { SESSION_HEADER } from "../../../../src/spa-contract";
import { ChangedByMutation } from "../../dashboard/changed-by-mutation";
import * as Mutation from "../../dashboard/mutation";
import * as Team from "../../dashboard/pages/Team";
import { SpaHttpClient } from "../../shared/spa-http-client";
import {
  init,
  LoadMe,
  LoadMembers,
  LoadTeam,
  LoadTeams,
  Message,
  type Model,
  reflectChange,
  update,
} from "../dashboard/main";
import { DashboardRoute } from "../dashboard/route";
import {
  Message as DocumentNavigationMessage,
  LeaveToSignIn,
  LoadDocument,
  NavigateInternal,
  ReloadDocument,
  ReplaceUrl,
} from "../document-navigation";

const ORIGIN = "https://app.example.com";
const TEAM_ID = TeamId.make("00000000-0000-4000-8000-0000000000aa");
const SKILL_ID = SkillId.make("00000000-0000-4000-8000-000000000001");
const MY_USER_ID = "u_1";

const TEAMS_ROUTE = "/dashboard/teams";
const TEAM_ROUTE = `/dashboard/teams/${TEAM_ID}`;
const MEMBERS_ROUTE = "/dashboard/members";

const ME = { userId: MY_USER_ID, name: "山田 花子", canManage: true };
const MEMBERS = {
  members: [
    { name: "山田 花子", email: "hanako@example.com", role: "OWNER" as const },
  ],
};
const teamsNamed = (name: string) => ({ teams: [{ id: TEAM_ID, name }] });
const teamPageWithMyLevel = (level: 0 | 1 | 2 | 3) => ({
  team: {
    id: TEAM_ID,
    name: "開発",
    skills: [{ id: SKILL_ID, name: "設計" }],
    assignedUserIds: [MY_USER_ID],
    levels: [
      { userId: MY_USER_ID, skillId: SKILL_ID, level, wantsToLearn: false },
    ],
  },
  members: [{ userId: MY_USER_ID, name: "山田 花子" }],
});
const SAVED_LEVEL_3 = {
  skillId: SKILL_ID,
  level: 3,
  wantsToLearn: true,
} as const;
const SAVED_MY_LEVELS = ChangedByMutation.MyLevels({
  teamId: TEAM_ID,
  myUserId: MY_USER_ID,
  entries: [SAVED_LEVEL_3],
});

const urlOf = (pathname: string) =>
  Option.getOrThrowWith(
    fromString(`${ORIGIN}${pathname}`),
    () => new Error(`URL として読めない: ${pathname}`),
  );

const entered = (pathname: string) =>
  Message.ChangedUrl({ url: urlOf(pathname) });

const teamsLoaded = (request: number, name: string) =>
  Message.SettledLoadTeams({
    request,
    result: Result.succeed(teamsNamed(name)),
  });

const teamsFailed = (request: number, failureMessage: string) =>
  Message.SettledLoadTeams({ request, result: Result.fail(failureMessage) });

const teamLoaded = (request: number, level: 0 | 1 | 2 | 3) =>
  Message.SettledLoadTeam({
    teamId: TEAM_ID,
    request,
    result: Result.succeed(teamPageWithMyLevel(level)),
  });

const teamFailed = (request: number, failureMessage: string) =>
  Message.SettledLoadTeam({
    teamId: TEAM_ID,
    request,
    result: Result.fail(failureMessage),
  });

const received = (start: Model, ...messages: ReadonlyArray<Message>) =>
  messages.reduce((current, next) => update(current, next).model, start);

const reflected = (start: Model, changed: ChangedByMutation) =>
  reflectChange(changed)(start);

const issuedBy = (step: {
  readonly commands?: ReadonlyArray<{
    readonly name: string;
    readonly args?: unknown;
  }>;
}) => (step.commands ?? []).map(({ name, args }) => ({ name, args }));

const teamsOf = (current: Model) =>
  Option.getOrUndefined(AsyncData.getData(current.teams.data));

const teamCacheOf = (current: Model) =>
  Option.getOrThrow(HashMap.get(current.teamById, TEAM_ID));

const teamOf = (current: Model) =>
  Option.getOrUndefined(AsyncData.getData(teamCacheOf(current).data));

const myLevelsOf = (current: Model) =>
  teamOf(current)?.team.levels.map(({ level }) => level);

const teamsOpened = init(urlOf(TEAMS_ROUTE)).model;
const teamsShown = received(teamsOpened, teamsLoaded(1, "前の一覧"));
const teamsShownThenLeft = received(teamsShown, entered(MEMBERS_ROUTE));
const teamShown = received(teamsShown, entered(TEAM_ROUTE), teamLoaded(1, 1));

describe("route に入る時の cache", () => {
  it.each([
    [TEAMS_ROUTE, [LoadMe({ request: 1 }), LoadTeams({ request: 1 })]],
    [
      TEAM_ROUTE,
      [LoadMe({ request: 1 }), LoadTeam({ teamId: TEAM_ID, request: 1 })],
    ],
    [MEMBERS_ROUTE, [LoadMe({ request: 1 }), LoadMembers({ request: 1 })]],
    ["/dashboard/no-such-page", [LoadMe({ request: 1 })]],
  ])(
    "%s で開くと、自分と、その route の値だけを取得する",
    (pathname, loads) => {
      expect(issuedBy(init(urlOf(pathname)))).toEqual(
        issuedBy({ commands: loads }),
      );
    },
  );

  it("値の無い route に入ると、取得が済むまで値を持たず、取得した値を持ち、失敗を持たない", () => {
    expect(teamsOf(teamsOpened)).toBeUndefined();

    story(
      update,
      given(teamsOpened),
      message(teamsLoaded(1, "開発")),
      model((next) => {
        expect(teamsOf(next)).toEqual(teamsNamed("開発"));
        expect(AsyncData.getError(next.teams.data)).toEqual(Option.none());
      }),
    );
  });

  it("取得の済んだ route に入ると、取り直しを待たずに前の値を持ち、裏で 1 回取り直す", () => {
    story(
      update,
      given(teamsShownThenLeft),
      message(entered(TEAMS_ROUTE)),
      model((next) => {
        expect(teamsOf(next)).toEqual(teamsNamed("前の一覧"));
      }),
      Command.expectExact(LoadTeams({ request: 2 })),
      Command.resolve(LoadTeams, teamsLoaded(2, "取り直した一覧")),
      model((next) => {
        expect(teamsOf(next)).toEqual(teamsNamed("取り直した一覧"));
      }),
    );
  });

  it("裏で取り直している最中の route に入っても、取り直しを足さず、前の値を持つ", () => {
    const refetching = received(teamsShownThenLeft, entered(TEAMS_ROUTE));

    story(
      update,
      given(received(refetching, entered(MEMBERS_ROUTE))),
      message(entered(TEAMS_ROUTE)),
      Command.expectNone(),
      model((next) => {
        expect(teamsOf(next)).toEqual(teamsNamed("前の一覧"));
      }),
    );
  });

  it("更新で古くした route に入ると、古くする前の値を持たず、取り直した値を持つ", () => {
    const outdated = reflected(
      teamsShownThenLeft,
      ChangedByMutation.TeamList(),
    ).model;

    story(
      update,
      given(outdated),
      message(entered(TEAMS_ROUTE)),
      model((next) => {
        expect(teamsOf(next)).toBeUndefined();
      }),
      Command.expectExact(LoadTeams({ request: 2 })),
      Command.resolve(LoadTeams, teamsLoaded(2, "取り直した一覧")),
      model((next) => {
        expect(teamsOf(next)).toEqual(teamsNamed("取り直した一覧"));
      }),
    );
  });

  it("古くした route の取り直しを待つ間にもう一度入っても、取り直しを足さず、前の値を持たない", () => {
    const waiting = received(
      reflected(teamsShownThenLeft, ChangedByMutation.TeamList()).model,
      entered(TEAMS_ROUTE),
      entered(MEMBERS_ROUTE),
    );

    story(
      update,
      given(waiting),
      message(entered(TEAMS_ROUTE)),
      Command.expectNone(),
      model((next) => {
        expect(teamsOf(next)).toBeUndefined();
      }),
    );
  });

  it("古くする前に始まった取得が進行中でも、古くした後に入ると取り直し、前に始まった取得の応答を捨てる", () => {
    const refetching = received(teamsShownThenLeft, entered(TEAMS_ROUTE));
    const outdatedWhileRefetching = received(
      reflected(refetching, ChangedByMutation.TeamList()).model,
      entered(MEMBERS_ROUTE),
    );

    story(
      update,
      given(outdatedWhileRefetching),
      message(entered(TEAMS_ROUTE)),
      Command.expectExact(LoadTeams({ request: 3 })),
      Command.resolve(LoadTeams, teamsLoaded(2, "古くする前に始まった取得")),
      model((next) => {
        expect(teamsOf(next)).toBeUndefined();
      }),
      message(teamsLoaded(3, "古くした後の取得")),
      model((next) => {
        expect(teamsOf(next)).toEqual(teamsNamed("古くした後の取得"));
      }),
    );
  });

  it("後から始めた取得の応答の後に、前に始めた取得の応答が届いても、後の値のまま変えない", () => {
    const afterLaterResponse = received(
      reflected(
        received(teamsShownThenLeft, entered(TEAMS_ROUTE)),
        ChangedByMutation.TeamList(),
      ).model,
      entered(MEMBERS_ROUTE),
      entered(TEAMS_ROUTE),
      teamsLoaded(3, "後から始めた取得"),
    );

    story(
      update,
      given(afterLaterResponse),
      message(teamsLoaded(2, "前に始めた取得")),
      model((next) => {
        expect(teamsOf(next)).toEqual(teamsNamed("後から始めた取得"));
      }),
    );
  });

  it("取り直しを待つ間に古くし直すと、届いた値を持ち、次に入る時も取り直しを待つ", () => {
    const waiting = received(
      reflected(teamsShownThenLeft, ChangedByMutation.TeamList()).model,
      entered(TEAMS_ROUTE),
    );
    const outdatedAgain = received(
      reflected(waiting, ChangedByMutation.TeamList()).model,
      teamsLoaded(2, "古くし直す前に始まった取得"),
      entered(MEMBERS_ROUTE),
    );
    expect(teamsOf(outdatedAgain)).toEqual(
      teamsNamed("古くし直す前に始まった取得"),
    );

    story(
      update,
      given(outdatedAgain),
      message(entered(TEAMS_ROUTE)),
      model((next) => {
        expect(teamsOf(next)).toBeUndefined();
      }),
      Command.expectExact(LoadTeams({ request: 3 })),
      Command.resolve(LoadTeams, teamsLoaded(3, "取り直した一覧")),
    );
  });

  it("裏の取り直しが失敗しても、前の値を持ち続け、失敗の文言も持つ", () => {
    story(
      update,
      given(received(teamsShownThenLeft, entered(TEAMS_ROUTE))),
      message(teamsFailed(2, "チームを取得できませんでした")),
      model((next) => {
        expect(teamsOf(next)).toEqual(teamsNamed("前の一覧"));
        expect(AsyncData.getError(next.teams.data)).toEqual(
          Option.some("チームを取得できませんでした"),
        );
      }),
    );
  });

  it("裏の取り直しが失敗した route に入ると、取り直しを待たずに前の値を持ち、もう一度取り直す", () => {
    const failedToRefetch = received(
      teamsShownThenLeft,
      entered(TEAMS_ROUTE),
      teamsFailed(2, "チームを取得できませんでした"),
      entered(MEMBERS_ROUTE),
    );

    story(
      update,
      given(failedToRefetch),
      message(entered(TEAMS_ROUTE)),
      model((next) => {
        expect(teamsOf(next)).toEqual(teamsNamed("前の一覧"));
      }),
      Command.expectExact(LoadTeams({ request: 3 })),
      Command.resolve(LoadTeams, teamsLoaded(3, "取り直した一覧")),
    );
  });

  it("値の無い取得が失敗すると、値を持たず、失敗の文言を持つ", () => {
    story(
      update,
      given(teamsOpened),
      message(teamsFailed(1, "チームを取得できませんでした")),
      model((next) => {
        expect(teamsOf(next)).toBeUndefined();
        expect(AsyncData.getError(next.teams.data)).toEqual(
          Option.some("チームを取得できませんでした"),
        );
      }),
    );
  });

  it("取得が失敗した route にもう一度入ると、取り直し、その値を持つ", () => {
    const failedToLoad = received(
      teamsOpened,
      teamsFailed(1, "チームを取得できませんでした"),
      entered(MEMBERS_ROUTE),
    );

    story(
      update,
      given(failedToLoad),
      message(entered(TEAMS_ROUTE)),
      Command.expectExact(LoadTeams({ request: 2 })),
      Command.resolve(LoadTeams, teamsLoaded(2, "開発")),
      model((next) => {
        expect(teamsOf(next)).toEqual(teamsNamed("開発"));
      }),
    );
  });

  it("別のチームの route に入ると、前に見たチームの値を出さずに、そのチームを取得する", () => {
    const otherTeamId = "00000000-0000-4000-8000-0000000000bb";

    story(
      update,
      given(teamShown),
      message(entered(`/dashboard/teams/${otherTeamId}`)),
      Command.expectExact(LoadTeam({ teamId: otherTeamId, request: 1 })),
      Command.resolve(
        LoadTeam,
        Message.SettledLoadTeam({
          teamId: otherTeamId,
          request: 1,
          result: Result.fail("チームが見つかりません"),
        }),
      ),
      model((next) => {
        expect(
          Option.map(HashMap.get(next.teamById, otherTeamId), ({ data }) =>
            AsyncData.getData(data),
          ),
        ).toEqual(Option.some(Option.none()));
        expect(teamOf(next)).toEqual(teamPageWithMyLevel(1));
      }),
    );
  });

  it("入る route を変えるたびに、自分も裏で取り直す", () => {
    const meShown = received(
      teamsShown,
      Message.SettledLoadMe({ request: 1, result: Result.succeed(ME) }),
    );

    story(
      update,
      given(meShown),
      message(entered(MEMBERS_ROUTE)),
      Command.expectExact(LoadMe({ request: 2 }), LoadMembers({ request: 1 })),
      Command.resolve(
        LoadMe,
        Message.SettledLoadMe({ request: 2, result: Result.succeed(ME) }),
      ),
      Command.resolve(
        LoadMembers,
        Message.SettledLoadMembers({
          request: 1,
          result: Result.succeed(MEMBERS),
        }),
      ),
      model((next) => {
        expect(AsyncData.getData(next.me.data)).toEqual(Option.some(ME));
        expect(AsyncData.getData(next.members.data)).toEqual(
          Option.some(MEMBERS),
        );
      }),
    );
  });
});

describe("link に hover した時の先読み", () => {
  const hovered = Message.HoveredLink({
    route: DashboardRoute.Team({ teamId: TEAM_ID }),
  });

  it("値の無い route の link に hover すると、その route の値を取得する", () => {
    story(
      update,
      given(teamsShown),
      message(hovered),
      Command.expectExact(LoadTeam({ teamId: TEAM_ID, request: 1 })),
      Command.resolve(LoadTeam, teamLoaded(1, 1)),
      model((next) => {
        expect(teamOf(next)).toEqual(teamPageWithMyLevel(1));
      }),
    );
  });

  it.each([
    ["応答が届く前に", received(teamsShown, hovered)],
    ["応答が届いた後に", received(teamsShown, hovered, teamLoaded(1, 1))],
  ])("先読みした route へ %s入っても、取り直さない", (_, prefetched) => {
    story(
      update,
      given(prefetched),
      message(entered(TEAM_ROUTE)),
      Command.expectNone(),
    );
  });

  it("先読みした route へ入った後、もう一度入ると、裏で取り直す", () => {
    const enteredOnce = received(
      teamsShown,
      hovered,
      teamLoaded(1, 1),
      entered(TEAM_ROUTE),
      entered(TEAMS_ROUTE),
      teamsLoaded(2, "前の一覧"),
    );

    story(
      update,
      given(enteredOnce),
      message(entered(TEAM_ROUTE)),
      Command.expectExact(LoadTeam({ teamId: TEAM_ID, request: 2 })),
      Command.resolve(LoadTeam, teamLoaded(2, 2)),
    );
  });

  it.each([
    ["値の在る route", teamShown, hovered],
    [
      "更新が古くした route",
      reflected(teamShown, ChangedByMutation.TeamList()).model,
      Message.HoveredLink({ route: DashboardRoute.Teams() }),
    ],
    [
      "cache を持たない route",
      teamsShown,
      Message.HoveredLink({
        route: DashboardRoute.NotFound({ path: "/dashboard/no-such-page" }),
      }),
    ],
  ])("%s の link に hover しても、取得しない", (_, shown, hoveredLink) => {
    story(update, given(shown), message(hoveredLink), Command.expectNone());
  });
});

describe("更新が変えたものを cache に反映する", () => {
  it("一覧を変えた更新を反映すると、一覧を取り直さず、チームも取り直さず、次に一覧へ入る時に取り直しを待つ", () => {
    const reflection = reflected(teamShown, ChangedByMutation.TeamList());

    expect(issuedBy(reflection)).toEqual([]);
    expect(teamsOf(reflection.model)).toEqual(teamsNamed("前の一覧"));
    story(
      update,
      given(reflection.model),
      message(entered(TEAMS_ROUTE)),
      model((next) => {
        expect(teamsOf(next)).toBeUndefined();
      }),
      Command.expectExact(LoadTeams({ request: 2 })),
      Command.resolve(LoadTeams, teamsLoaded(2, "取り直した一覧")),
    );
  });

  it("チームを変えた更新を反映すると、一覧を古くし、前の値を持ったままチームを取り直す", () => {
    const reflection = reflected(
      teamShown,
      ChangedByMutation.Team({ teamId: TEAM_ID }),
    );

    expect(issuedBy(reflection)).toEqual(
      issuedBy({ commands: [LoadTeam({ teamId: TEAM_ID, request: 2 })] }),
    );
    expect(teamOf(reflection.model)).toEqual(teamPageWithMyLevel(1));
    expect(teamOf(received(reflection.model, teamLoaded(2, 2)))).toEqual(
      teamPageWithMyLevel(2),
    );
    story(
      update,
      given(reflection.model),
      message(entered(TEAMS_ROUTE)),
      model((next) => {
        expect(teamsOf(next)).toBeUndefined();
      }),
      Command.expectExact(LoadTeams({ request: 2 })),
      Command.resolve(LoadTeams, teamsLoaded(2, "取り直した一覧")),
    );
  });

  it("チームを変えた更新の後の取り直しが失敗しても、前の値を持ち続ける", () => {
    const refetching = reflected(
      teamShown,
      ChangedByMutation.Team({ teamId: TEAM_ID }),
    ).model;

    expect(
      teamOf(
        received(refetching, teamFailed(2, "チームを取得できませんでした")),
      ),
    ).toEqual(teamPageWithMyLevel(1));
  });

  it("チームの取得が進行中でも、チームを変えた更新を反映すると取り直し、前に始まった取得の応答を捨てる", () => {
    const refetchingOnEntry = received(
      teamShown,
      entered(TEAMS_ROUTE),
      entered(TEAM_ROUTE),
    );
    const reflection = reflected(
      refetchingOnEntry,
      ChangedByMutation.Team({ teamId: TEAM_ID }),
    );

    expect(issuedBy(reflection)).toEqual(
      issuedBy({ commands: [LoadTeam({ teamId: TEAM_ID, request: 3 })] }),
    );
    expect(
      teamOf(received(reflection.model, teamLoaded(2, 0), teamLoaded(3, 2))),
    ).toEqual(teamPageWithMyLevel(2));
    expect(teamOf(received(reflection.model, teamLoaded(2, 0)))).toEqual(
      teamPageWithMyLevel(1),
    );
  });

  it("チームを消した更新を反映すると、一覧と消したチームを古くし、チームを取り直さない", () => {
    const reflection = reflected(
      teamShown,
      ChangedByMutation.TeamDeleted({ teamId: TEAM_ID }),
    );

    expect(issuedBy(reflection)).toEqual([]);
    expect(teamOf(reflection.model)).toEqual(teamPageWithMyLevel(1));
    story(
      update,
      given(reflection.model),
      message(entered(TEAMS_ROUTE)),
      model((next) => {
        expect(teamsOf(next)).toBeUndefined();
      }),
      Command.expectExact(LoadTeams({ request: 2 })),
      Command.resolve(LoadTeams, teamsLoaded(2, "取り直した一覧")),
    );
  });

  it("チームを消した更新を反映した後にそのチームへ入ると、前の値を持たずに取り直しを待ち、見つからない文言を持つ", () => {
    const deleted = reflected(
      teamShown,
      ChangedByMutation.TeamDeleted({ teamId: TEAM_ID }),
    ).model;

    story(
      update,
      given(received(deleted, entered(TEAMS_ROUTE))),
      message(entered(TEAM_ROUTE)),
      model((next) => {
        expect(teamOf(next)).toBeUndefined();
      }),
      Command.expectExact(LoadTeam({ teamId: TEAM_ID, request: 2 })),
      Command.resolve(LoadTeam, teamFailed(2, "チームが見つかりません")),
      model((next) => {
        expect(teamOf(next)).toBeUndefined();
        expect(AsyncData.getError(teamCacheOf(next).data)).toEqual(
          Option.some("チームが見つかりません"),
        );
      }),
    );
  });

  it("自分のレベルを保存した更新を反映すると、チームを取り直さずに保存した値を書き、一覧を古くしない", () => {
    const reflection = reflected(teamShown, SAVED_MY_LEVELS);

    expect(issuedBy(reflection)).toEqual([]);
    expect(teamOf(reflection.model)?.team.levels).toEqual([
      { userId: MY_USER_ID, ...SAVED_LEVEL_3 },
    ]);
    story(
      update,
      given(reflection.model),
      message(entered(TEAMS_ROUTE)),
      model((next) => {
        expect(teamsOf(next)).toEqual(teamsNamed("前の一覧"));
      }),
      Command.expectExact(LoadTeams({ request: 2 })),
      Command.resolve(LoadTeams, teamsLoaded(2, "取り直した一覧")),
    );
  });

  it("保存した自分のレベルは、同じチームのほかの人の記入を変えない", () => {
    const withColleague = received(
      teamsShown,
      entered(TEAM_ROUTE),
      Message.SettledLoadTeam({
        teamId: TEAM_ID,
        request: 1,
        result: Result.succeed({
          team: {
            ...teamPageWithMyLevel(1).team,
            levels: [
              {
                userId: "u_2",
                skillId: SKILL_ID,
                level: 2,
                wantsToLearn: false,
              },
            ],
          },
          members: null,
        }),
      }),
    );

    expect(
      teamOf(reflected(withColleague, SAVED_MY_LEVELS).model)?.team.levels,
    ).toEqual([
      { userId: "u_2", skillId: SKILL_ID, level: 2, wantsToLearn: false },
      { userId: MY_USER_ID, ...SAVED_LEVEL_3 },
    ]);
  });

  it("保存を反映した後にチームへ入り直すと、取り直した値に替わる", () => {
    const saved = received(
      reflected(teamShown, SAVED_MY_LEVELS).model,
      entered(TEAMS_ROUTE),
    );

    story(
      update,
      given(saved),
      message(entered(TEAM_ROUTE)),
      model((next) => {
        expect(myLevelsOf(next)).toEqual([3]);
      }),
      Command.expectExact(LoadTeam({ teamId: TEAM_ID, request: 2 })),
      Command.resolve(LoadTeam, teamLoaded(2, 2)),
      model((next) => {
        expect(myLevelsOf(next)).toEqual([2]);
      }),
    );
  });

  it("保存を反映した後の取り直しが失敗し、次の取り直しも失敗しても、保存した値を持つ", () => {
    const failedTwice = received(
      reflected(teamShown, SAVED_MY_LEVELS).model,
      entered(TEAMS_ROUTE),
      entered(TEAM_ROUTE),
      teamFailed(2, "チームを取得できませんでした"),
      entered(TEAMS_ROUTE),
      entered(TEAM_ROUTE),
      teamFailed(3, "チームを取得できませんでした"),
    );

    expect(myLevelsOf(failedTwice)).toEqual([3]);
  });

  it("保存の前に始まった取得の応答が保存の後に届いても、保存した値を持ち、保存の後に取り直した値に替わる", () => {
    const refetchingOnEntry = received(
      teamShown,
      entered(TEAMS_ROUTE),
      entered(TEAM_ROUTE),
    );
    const reflection = reflected(refetchingOnEntry, SAVED_MY_LEVELS);

    expect(issuedBy(reflection)).toEqual(
      issuedBy({ commands: [LoadTeam({ teamId: TEAM_ID, request: 3 })] }),
    );
    const afterResponseStartedBeforeSave = received(
      reflection.model,
      teamLoaded(2, 1),
    );
    expect(myLevelsOf(afterResponseStartedBeforeSave)).toEqual([3]);
    expect(
      myLevelsOf(received(afterResponseStartedBeforeSave, teamLoaded(3, 2))),
    ).toEqual([2]);
  });

  it("保存を反映した後に別の route へ移っても、保存した値を持つ", () => {
    expect(
      myLevelsOf(
        received(
          reflected(teamShown, SAVED_MY_LEVELS).model,
          entered(MEMBERS_ROUTE),
        ),
      ),
    ).toEqual([3]);
  });

  it("値を持たないチームの保存を反映しても、取得を始めない", () => {
    expect(issuedBy(reflected(teamsShown, SAVED_MY_LEVELS))).toEqual([]);
  });

  it("自分のレベルの変更に、契約に無い level を渡すと型エラーになり (bun run typecheck で見る)、実行しても作れない", () => {
    expect(() =>
      ChangedByMutation.MyLevels({
        teamId: TEAM_ID,
        myUserId: MY_USER_ID,
        // @ts-expect-error level は契約の 0〜3 の数
        entries: [{ skillId: SKILL_ID, level: "2", wantsToLearn: false }],
      }),
    ).toThrow();
  });
});

describe("document を離れる", () => {
  it("ログインが要る応答を受けると、ログインへ移る", () => {
    story(
      update,
      given(teamsOpened),
      message(Message.RequiredSignIn()),
      Command.expectExact(LeaveToSignIn()),
      Command.resolve(
        LeaveToSignIn,
        DocumentNavigationMessage.CompletedLeaveToSignIn(),
      ),
      model((next) => {
        expect(next).toEqual(teamsOpened);
      }),
    );
  });

  it("session が変わった応答を受けると、document を読み直す", () => {
    story(
      update,
      given(teamsShown),
      message(Message.ChangedSession()),
      Command.expectExact(ReloadDocument()),
      Command.resolve(
        ReloadDocument,
        DocumentNavigationMessage.CompletedReloadDocument(),
      ),
    );
  });

  it("/dashboard で開くと、自分を取得し、URL を /dashboard/teams に置き換える", () => {
    expect(issuedBy(init(urlOf("/dashboard")))).toEqual(
      issuedBy({
        commands: [LoadMe({ request: 1 }), ReplaceUrl({ href: TEAMS_ROUTE })],
      }),
    );
  });

  it("dashboard の route への link は、document を読み直さずに URL を替える", () => {
    story(
      update,
      given(teamsShown),
      message(
        Message.ClickedLink({
          request: UrlRequest.Internal({ url: urlOf(MEMBERS_ROUTE) }),
        }),
      ),
      Command.expectExact(
        NavigateInternal({ href: `${ORIGIN}${MEMBERS_ROUTE}` }),
      ),
      Command.resolve(
        NavigateInternal,
        DocumentNavigationMessage.CompletedNavigateInternal(),
      ),
    );
  });

  it.each([
    [UrlRequest.Internal({ url: urlOf("/privacy") }), `${ORIGIN}/privacy`],
    [
      UrlRequest.Internal({ url: urlOf("/dashboard/no-such-page") }),
      `${ORIGIN}/dashboard/no-such-page`,
    ],
    [
      UrlRequest.External({ href: "https://example.com/" }),
      "https://example.com/",
    ],
  ])(
    "dashboard の route でない link は、その行き先へ document を読み直す (%#)",
    (request, href) => {
      story(
        update,
        given(teamsShown),
        message(Message.ClickedLink({ request })),
        Command.expectExact(LoadDocument({ href })),
        Command.resolve(
          LoadDocument,
          DocumentNavigationMessage.CompletedLoadDocument(),
        ),
      );
    },
  );
});

describe("取得の Command", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubFetch = (respond: (apiPath: string) => Response) => {
    const requestedPaths: Array<string> = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const apiPath = new URL(input instanceof Request ? input.url : input)
        .pathname;
      requestedPaths.push(apiPath);
      return respond(apiPath);
    });
    return requestedPaths;
  };

  const startClient = () => ManagedRuntime.make(SpaHttpClient.layer(ORIGIN));

  const run = (
    command: {
      readonly effect: Effect.Effect<Message, never, SpaHttpClient>;
    },
    client = startClient(),
  ) => client.runPromise(command.effect);

  it("契約に宣言した失敗で取得が終わると、その失敗の文言を結果に持つ", async () => {
    stubFetch(() =>
      Response.json({ _tag: "TeamNotFound", teamId: TEAM_ID }, { status: 404 }),
    );

    await expect(
      run(LoadTeam({ teamId: TEAM_ID, request: 4 })),
    ).resolves.toEqual(teamFailed(4, "チームが見つかりません"));
  });

  it.each([
    [LoadMe({ request: 1 }), "画面を読み込めませんでした"],
    [LoadTeams({ request: 1 }), "チームを取得できませんでした"],
    [LoadTeam({ teamId: TEAM_ID, request: 1 }), "チームを取得できませんでした"],
    [LoadMembers({ request: 1 }), "メンバー一覧を取得できませんでした"],
  ])(
    "契約に無い応答 (本文の無い 500) で取得が終わると、その取得の既定の文言を結果に持つ (%#)",
    async (command, failureMessage) => {
      stubFetch(() => new Response(null, { status: 500 }));

      const settled = await run(command);

      expect("result" in settled && settled.result).toEqual(
        Result.fail(failureMessage),
      );
    },
  );

  it("通信できずに取得が終わると、その取得の既定の文言を結果に持つ", async () => {
    vi.stubGlobal("fetch", () => Promise.reject(new TypeError("offline")));

    await expect(run(LoadTeams({ request: 1 }))).resolves.toEqual(
      teamsFailed(1, "チームを取得できませんでした"),
    );
  });

  it("取得した値を、要求の番号と一緒に結果に持つ", async () => {
    stubFetch(() => Response.json(teamsNamed("開発")));

    await expect(run(LoadTeams({ request: 7 }))).resolves.toEqual(
      teamsLoaded(7, "開発"),
    );
  });

  const EVERY_LOAD = [
    LoadMe({ request: 1 }),
    LoadTeams({ request: 1 }),
    LoadTeam({ teamId: TEAM_ID, request: 1 }),
    LoadMembers({ request: 1 }),
  ];

  it.each(EVERY_LOAD)(
    "どの取得も、401 の応答はログインが要ることとして届く (%#)",
    async (command) => {
      stubFetch(() =>
        Response.json({ _tag: "Unauthenticated" }, { status: 401 }),
      );

      await expect(run(command)).resolves.toEqual(Message.RequiredSignIn());
    },
  );

  it.each(EVERY_LOAD)(
    "どの取得も、session の印が最初に受けた印と変わると、session が変わったこととして届く (%#)",
    async (command) => {
      const marks = ["company_a u_1", "company_b u_1"];
      stubFetch(() =>
        Response.json(ME, {
          headers: { [SESSION_HEADER]: marks.shift() ?? "" },
        }),
      );
      const client = startClient();
      await run(LoadMe({ request: 1 }), client);

      await expect(run(command, client)).resolves.toEqual(
        Message.ChangedSession(),
      );
    },
  );

  it("別のタブで事業所や user を切り替えた後に、session の印が最初に受けた印と変わると、session が変わったこととして届く", async () => {
    const marks = ["company_a u_1", "company_b u_1"];
    stubFetch(() =>
      Response.json(ME, {
        headers: { [SESSION_HEADER]: marks.shift() ?? "" },
      }),
    );
    const client = startClient();

    const first = await run(LoadMe({ request: 1 }), client);
    const second = await run(LoadMe({ request: 2 }), client);

    expect([first, second]).toEqual([
      Message.SettledLoadMe({ request: 1, result: Result.succeed(ME) }),
      Message.ChangedSession(),
    ]);
  });

  it("session の印が同じなら、取得した値が届く", async () => {
    stubFetch(() =>
      Response.json(ME, { headers: { [SESSION_HEADER]: "company_a u_1" } }),
    );
    const client = startClient();

    await run(LoadMe({ request: 1 }), client);

    await expect(run(LoadMe({ request: 2 }), client)).resolves.toEqual(
      Message.SettledLoadMe({ request: 2, result: Result.succeed(ME) }),
    );
  });

  it("チームの取得は、id を escape して path に入れる", async () => {
    const requestedPaths = stubFetch(() =>
      Response.json(teamPageWithMyLevel(1)),
    );

    await run(LoadTeam({ teamId: "../members", request: 1 }));

    expect(requestedPaths).toEqual(["/api/teams/..%2Fmembers"]);
  });
});

describe("チームの削除の成功", () => {
  const teamDeleted = Message.GotTeamPageMessage({
    teamId: TEAM_ID,
    message: Team.Message.GotMutationMessage({
      slotId: "deleting",
      message: Mutation.Message.SucceededMutation({
        changed: ChangedByMutation.TeamDeleted({ teamId: TEAM_ID }),
        maybeCreatedTeamId: Option.none(),
      }),
    }),
  });

  it("消したチームの画面にいれば、一覧へ移る", () => {
    expect(issuedBy(update(teamShown, teamDeleted))).toEqual(
      issuedBy({ commands: [NavigateInternal({ href: TEAMS_ROUTE })] }),
    );
  });

  it("成功が届く前に別の画面へ移っていれば、その画面のまま", () => {
    const leftBeforeSuccess = received(teamShown, entered(MEMBERS_ROUTE));

    expect(issuedBy(update(leftBeforeSuccess, teamDeleted))).toEqual([]);
  });
});
