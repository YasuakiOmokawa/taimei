import { Effect, HashMap, Match, Option, Result, Schema } from "effect";
import { AsyncData, Command, Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import { UrlRequest } from "foldkit/navigation";
import { modifyFields } from "foldkit/struct";
import { Url } from "foldkit/url";
import { Team, TeamDetail } from "../../../../src/spa-contract";
import { ChangedByMutation } from "../../dashboard/changed-by-mutation";
import { withMyLevels } from "../../dashboard/skill-matrix";
import { failureMessageOf } from "../../shared/failure-message";
import { SpaHttpClient } from "../../shared/spa-http-client";
import * as DocumentNavigation from "../document-navigation";
import { DashboardRoute, teamsRouter, urlToDashboardRoute } from "./route";

const Me = Schema.Struct({
  userId: Schema.String,
  name: Schema.String,
  canManage: Schema.Boolean,
});
type Me = typeof Me.Type;

const TeamList = Schema.Struct({ teams: Schema.Array(Team) });
type TeamList = typeof TeamList.Type;

const TeamPage = Schema.Struct({
  team: TeamDetail,
  members: Schema.NullOr(
    Schema.Array(Schema.Struct({ userId: Schema.String, name: Schema.String })),
  ),
});
type TeamPage = typeof TeamPage.Type;

const MemberList = Schema.Struct({
  members: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      email: Schema.String,
      role: Schema.optionalKey(Schema.Literals(["OWNER", "ADMIN", "MEMBER"])),
    }),
  ),
});
type MemberList = typeof MemberList.Type;

const OnNextEntry = Schema.Literals(["Revalidate", "UseAsIs", "Wait"]);
type OnNextEntry = typeof OnNextEntry.Type;

type Loaded<Value> = AsyncData.AsyncData<Value, string>;

type Cached<Value> = Readonly<{
  data: Loaded<Value>;
  request: number;
  onNextEntry: OnNextEntry;
}>;

const cachedOf = <Value, Encoded>(value: Schema.Codec<Value, Encoded>) =>
  Schema.Struct({
    data: AsyncData.Schema(value, Schema.String).schema,
    request: Schema.Int,
    onNextEntry: OnNextEntry,
  });

const neverLoaded = <Value>(): Cached<Value> => ({
  data: AsyncData.Idle(),
  request: 0,
  onNextEntry: "Revalidate",
});

export const Model = Schema.Struct({
  route: DashboardRoute,
  me: cachedOf(Me),
  teams: cachedOf(TeamList),
  teamById: Schema.HashMap(Schema.String, cachedOf(TeamPage)),
  members: cachedOf(MemberList),
});
export type Model = typeof Model.Type;

const settledWith = <Value, Encoded>(value: Schema.Codec<Value, Encoded>) => ({
  request: Schema.Int,
  result: Schema.Result(value, Schema.String),
});

export const Message = defineMessageUnion({
  GotDocumentNavigationMessage: { message: DocumentNavigation.Message },
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  HoveredLink: { route: DashboardRoute },
  SettledLoadMe: settledWith(Me),
  SettledLoadTeams: settledWith(TeamList),
  SettledLoadTeam: { teamId: Schema.String, ...settledWith(TeamPage) },
  SettledLoadMembers: settledWith(MemberList),
  RequiredSignIn: {},
  ChangedSession: {},
});
export type Message = typeof Message.Type;

type UpdateReturn = Update.Return<Model, Message, SpaHttpClient>;
type Step = Update.Step<Model, Message, SpaHttpClient>;

const ME_LOAD_FAILED = "画面を読み込めませんでした";
const TEAM_LOAD_FAILED = "チームを取得できませんでした";
const MEMBERS_LOAD_FAILED = "メンバー一覧を取得できませんでした";

type SpaClient = SpaHttpClient["Service"];

type LoadFailure = Effect.Error<
  ReturnType<
    | SpaClient["me"]["get"]
    | SpaClient["teams"]["list"]
    | SpaClient["teams"]["get"]
    | SpaClient["members"]["list"]
  >
>;

const navigate = (command: Command.Command<DocumentNavigation.Message>) =>
  Command.mapMessage(command, (message) =>
    Message.GotDocumentNavigationMessage({ message }),
  );

const settledBy = <Value, Settled>(
  load: Effect.Effect<Value, LoadFailure, SpaHttpClient>,
  fallbackMessage: string,
  toSettled: (result: Result.Result<Value, string>) => Settled,
) =>
  load.pipe(
    Effect.map((value) => toSettled(Result.succeed(value))),
    Effect.catchTags({
      Unauthenticated: () => Effect.succeed(Message.RequiredSignIn()),
      SessionChanged: () => Effect.succeed(Message.ChangedSession()),
      HttpClientError: Effect.die,
      SchemaError: Effect.die,
    }),
    Effect.catchCause((cause) =>
      Effect.succeed(
        toSettled(Result.fail(failureMessageOf(cause, fallbackMessage))),
      ),
    ),
  );

const SESSION_LOST = [Message.RequiredSignIn, Message.ChangedSession] as const;

export const LoadMe = Command.define("LoadMe", {
  args: { request: Schema.Int },
  messages: [Message.SettledLoadMe, ...SESSION_LOST],
  execute: ({ request }) =>
    settledBy(
      SpaHttpClient.use((client) => client.me.get()),
      ME_LOAD_FAILED,
      (result) => Message.SettledLoadMe({ request, result }),
    ),
});

export const LoadTeams = Command.define("LoadTeams", {
  args: { request: Schema.Int },
  messages: [Message.SettledLoadTeams, ...SESSION_LOST],
  execute: ({ request }) =>
    settledBy(
      SpaHttpClient.use((client) => client.teams.list()),
      TEAM_LOAD_FAILED,
      (result) => Message.SettledLoadTeams({ request, result }),
    ),
});

export const LoadTeam = Command.define("LoadTeam", {
  args: { teamId: Schema.String, request: Schema.Int },
  messages: [Message.SettledLoadTeam, ...SESSION_LOST],
  execute: ({ teamId, request }) =>
    settledBy(
      SpaHttpClient.use((client) => client.teams.get({ params: { teamId } })),
      TEAM_LOAD_FAILED,
      (result) => Message.SettledLoadTeam({ teamId, request, result }),
    ),
});

export const LoadMembers = Command.define("LoadMembers", {
  args: { request: Schema.Int },
  messages: [Message.SettledLoadMembers, ...SESSION_LOST],
  execute: ({ request }) =>
    settledBy(
      SpaHttpClient.use((client) => client.members.list()),
      MEMBERS_LOAD_FAILED,
      (result) => Message.SettledLoadMembers({ request, result }),
    ),
});

type Slot<Value> = Readonly<{
  read: (model: Model) => Cached<Value>;
  write: (model: Model, next: Cached<Value>) => Model;
  load: (request: number) => Command.Command<Message, never, SpaHttpClient>;
}>;

const meSlot: Slot<Me> = {
  read: (model) => model.me,
  write: (model, next) => modifyFields(model, { me: () => next }),
  load: (request) => LoadMe({ request }),
};

const teamsSlot: Slot<TeamList> = {
  read: (model) => model.teams,
  write: (model, next) => modifyFields(model, { teams: () => next }),
  load: (request) => LoadTeams({ request }),
};

const teamSlot = (teamId: string): Slot<TeamPage> => ({
  read: (model) =>
    Option.getOrElse(HashMap.get(model.teamById, teamId), () =>
      neverLoaded<TeamPage>(),
    ),
  write: (model, next) =>
    modifyFields(model, { teamById: HashMap.set(teamId, next) }),
  load: (request) => LoadTeam({ teamId, request }),
});

const membersSlot: Slot<MemberList> = {
  read: (model) => model.members,
  write: (model, next) => modifyFields(model, { members: () => next }),
  load: (request) => LoadMembers({ request }),
};

const modifySlot = <Value>(
  slot: Slot<Value>,
  model: Model,
  modify: (cached: Cached<Value>) => Cached<Value>,
) => slot.write(model, modify(slot.read(model)));

const requestWith = <Value>(
  slot: Slot<Value>,
  model: Model,
  data: Loaded<Value>,
  onNextEntry: OnNextEntry,
): UpdateReturn => {
  const request = slot.read(model).request + 1;
  return {
    model: slot.write(model, { data, request, onNextEntry }),
    commands: [slot.load(request)],
  };
};

const dataOnEntry = <Value>(cached: Cached<Value>) =>
  Match.value(cached.onNextEntry).pipe(
    Match.withReturnType<Option.Option<Loaded<Value>>>(),
    Match.when("Revalidate", () => AsyncData.revalidateOrLoad(cached.data)),
    Match.when("UseAsIs", () => AsyncData.loadIfMissing(cached.data)),
    Match.when("Wait", () => Option.some(AsyncData.Loading())),
    Match.exhaustive,
  );

const enterSlot =
  <Value>(slot: Slot<Value>): Step =>
  (model) =>
    Option.match(dataOnEntry(slot.read(model)), {
      onNone: () => ({
        model: modifySlot(slot, model, (cached) =>
          modifyFields(cached, { onNextEntry: () => "Revalidate" }),
        ),
      }),
      onSome: (data) => requestWith(slot, model, data, "Revalidate"),
    });

const prefetchSlot =
  <Value>(slot: Slot<Value>): Step =>
  (model) =>
    Option.match(AsyncData.loadIfMissing(slot.read(model).data), {
      onNone: () => ({ model }),
      onSome: (data) => requestWith(slot, model, data, "UseAsIs"),
    });

const settleSlot =
  <Value>(
    slot: Slot<Value>,
    request: number,
    result: Result.Result<Value, string>,
  ): Step =>
  (model) =>
    slot.read(model).request === request
      ? {
          model: modifySlot(slot, model, (cached) =>
            modifyFields(cached, { data: AsyncData.settle(result) }),
          ),
        }
      : { model };

const outdateSlot =
  <Value>(slot: Slot<Value>): Step =>
  (model) => ({
    model: modifySlot(slot, model, (cached) =>
      modifyFields(cached, { onNextEntry: () => "Wait" }),
    ),
  });

const refetchSlot =
  <Value>(slot: Slot<Value>): Step =>
  (model) => {
    const shown = slot.read(model).data;
    return requestWith(
      slot,
      model,
      Option.getOrElse(AsyncData.revalidateOrLoad(shown), () => shown),
      "Revalidate",
    );
  };

const rewriteSlot =
  <Value>(slot: Slot<Value>, rewrite: (value: Value) => Value): Step =>
  (model) => {
    const cached = slot.read(model);
    const data = AsyncData.map(cached.data, rewrite);
    return AsyncData.isPending(cached.data)
      ? requestWith(slot, model, data, cached.onNextEntry)
      : {
          model: slot.write(model, modifyFields(cached, { data: () => data })),
        };
  };

const unchanged: Step = (model) => ({ model });

const onRouteSlot = (
  route: DashboardRoute,
  toStep: <Value>(slot: Slot<Value>) => Step,
) =>
  DashboardRoute.match<Step>(route, {
    Home: () => unchanged,
    Teams: () => toStep(teamsSlot),
    Team: ({ teamId }) => toStep(teamSlot(teamId)),
    Members: () => toStep(membersSlot),
    NotFound: () => unchanged,
  });

const replaceHomeWithTeams: Step = (model) =>
  DashboardRoute.guards.Home(model.route)
    ? {
        model,
        commands: [
          navigate(DocumentNavigation.ReplaceUrl({ href: teamsRouter() })),
        ],
      }
    : { model };

const enterRoute: Step = (model) =>
  Update.combine(model, [
    enterSlot(meSlot),
    onRouteSlot(model.route, enterSlot),
    replaceHomeWithTeams,
  ]);

const prefetchRoute = (route: DashboardRoute) =>
  onRouteSlot(route, prefetchSlot);

export const reflectChange = (changed: ChangedByMutation): Step =>
  ChangedByMutation.match<Step>(changed, {
    TeamList: () => outdateSlot(teamsSlot),
    Team: ({ teamId }) =>
      Update.combine([outdateSlot(teamsSlot), refetchSlot(teamSlot(teamId))]),
    TeamDeleted: ({ teamId }) =>
      Update.combine([outdateSlot(teamsSlot), outdateSlot(teamSlot(teamId))]),
    MyLevels: ({ teamId, myUserId, entries }) =>
      rewriteSlot(teamSlot(teamId), (page) =>
        modifyFields(page, {
          team: (team) => withMyLevels(team, myUserId, entries),
        }),
      ),
  });

const isOwnRoute = (url: Url) =>
  !DashboardRoute.guards.NotFound(urlToDashboardRoute(url));

export const init = (url: Url): UpdateReturn =>
  enterRoute({
    route: urlToDashboardRoute(url),
    me: neverLoaded(),
    teams: neverLoaded(),
    teamById: HashMap.empty(),
    members: neverLoaded(),
  });

export const update = (model: Model, message: Message) =>
  Message.match<UpdateReturn>(message, {
    GotDocumentNavigationMessage: () => ({ model }),
    ClickedLink: ({ request }) => ({
      model,
      commands: [
        navigate(DocumentNavigation.commandForLink(request, isOwnRoute)),
      ],
    }),
    ChangedUrl: ({ url }) =>
      enterRoute(
        modifyFields(model, { route: () => urlToDashboardRoute(url) }),
      ),
    HoveredLink: ({ route }) => prefetchRoute(route)(model),
    SettledLoadMe: ({ request, result }) =>
      settleSlot(meSlot, request, result)(model),
    SettledLoadTeams: ({ request, result }) =>
      settleSlot(teamsSlot, request, result)(model),
    SettledLoadTeam: ({ teamId, request, result }) =>
      settleSlot(teamSlot(teamId), request, result)(model),
    SettledLoadMembers: ({ request, result }) =>
      settleSlot(membersSlot, request, result)(model),
    RequiredSignIn: () => ({
      model,
      commands: [navigate(DocumentNavigation.LeaveToSignIn())],
    }),
    ChangedSession: () => ({
      model,
      commands: [navigate(DocumentNavigation.ReloadDocument())],
    }),
  });
