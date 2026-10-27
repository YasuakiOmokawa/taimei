import { Effect, Exit, Layer, Result, Schema } from "effect";
import { expect, it } from "vitest";
import { runTeamManagement, runTeamReads } from "@/src/services";
import { TeamService } from "@/src/services/team-service";
import {
  LevelEntry,
  TeamManagementGroup,
  TeamsGroup,
  Unauthenticated,
} from "@/src/spa-contract";
import { handledBy, SpaApiLive, spaApiResponder } from "@/src/spa-http-api";

const unreached = () => Effect.die("型だけを見る");
const managementHandlers = {
  create: unreached,
  rename: unreached,
  delete: unreached,
  addSkill: unreached,
  removeSkill: unreached,
  assign: unreached,
  unassign: unreached,
};

it("group の handler の表の型は、宣言していない失敗・生の request の読み取り・書き漏らし・別の Service を型エラーにする (bun run typecheck で見る)", () => {
  const tables = [
    handledBy(TeamManagementGroup, runTeamManagement, {
      ...managementHandlers,
      // @ts-expect-error teamManagement.delete は NotDeclared を宣言していない
      delete: () => Effect.fail("NotDeclared"),
    }),
    handledBy(TeamManagementGroup, runTeamManagement, {
      ...managementHandlers,
      // @ts-expect-error handler は decode した params・payload だけを受ける
      delete: (_, { request }) => Effect.succeed(request),
    }),
    // @ts-expect-error teams の endpoint は list だけではない
    handledBy(TeamsGroup, runTeamReads, {
      list: () => Effect.succeed({ teams: [] }),
    }),
    handledBy(TeamManagementGroup, runTeamManagement, {
      ...managementHandlers,
      // @ts-expect-error チームの管理の handler は TeamManagement だけを受け、TeamService を受けない
      delete: (teams: TeamService["Service"]) =>
        Effect.as(Effect.succeed(teams), undefined),
    }),
    handledBy(TeamManagementGroup, runTeamManagement, {
      ...managementHandlers,
      // @ts-expect-error チームの管理の handler の本体は TeamService を要求できない
      delete: () => TeamService.use(() => Effect.void),
    }),
  ];
  expect(tables).toHaveLength(5);
});

it("web handler は作った時には組まず、最初の要求で 1 回組み、2 回目の要求では組まない", async () => {
  let builds = 0;
  const respond = spaApiResponder(
    SpaApiLive.pipe(
      Layer.provideMerge(Layer.effectDiscard(Effect.sync(() => builds++))),
    ),
  );
  const request = () =>
    respond(
      new Request("http://app.example/api/me"),
      Result.fail(new Unauthenticated()),
    );

  const beforeRequest = builds;
  await request();
  const afterFirst = builds;
  await request();

  expect([beforeRequest, afterFirst, builds]).toEqual([0, 1, 1]);
});

it("契約は有限でないレベルを decode しない", () => {
  const decoded = Schema.decodeExit(LevelEntry)({
    skillId: "s",
    level: Number.POSITIVE_INFINITY,
    wantsToLearn: false,
  });

  expect(Exit.isFailure(decoded)).toBe(true);
});
