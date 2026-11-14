import {
  Array,
  Effect,
  Equal,
  HashMap,
  Match,
  Option,
  Result,
  Schema,
} from "effect";
import { AsyncData, Command, Update } from "foldkit";
import type { Document, Html, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { UrlRequest } from "foldkit/navigation";
import { modifyFields } from "foldkit/struct";
import { Url } from "foldkit/url";
import { Team as ListedTeam, TeamDetail } from "../../../../src/spa-contract";
import { ChangedByMutation } from "../../dashboard/changed-by-mutation";
import * as Mutation from "../../dashboard/mutation";
import * as Members from "../../dashboard/pages/Members";
import * as Team from "../../dashboard/pages/Team";
import * as Teams from "../../dashboard/pages/Teams";
import { withMyLevels } from "../../dashboard/skill-matrix";
import { failureMessageOf } from "../../shared/failure-message";
import { SpaHttpClient } from "../../shared/spa-http-client";
import { SERVICE_NAME } from "../../shared/ui/brand-view";
import { cn } from "../../shared/ui/class-names";
import * as DocumentNavigation from "../document-navigation";
import { privacyRouter } from "../public/route";
import {
  DashboardRoute,
  membersRouter,
  teamRouter,
  teamsRouter,
  urlToDashboardRoute,
} from "./route";

const Me = Schema.Struct({
  userId: Schema.String,
  name: Schema.String,
  canManage: Schema.Boolean,
});
type Me = typeof Me.Type;

const TeamList = Schema.Struct({ teams: Schema.Array(ListedTeam) });
type TeamList = typeof TeamList.Type;

const TeamPage = Schema.Struct({
  team: TeamDetail,
  members: Schema.NullOr(
    Schema.Array(Schema.Struct({ userId: Schema.String, name: Schema.String })),
  ),
});
type TeamPage = typeof TeamPage.Type;

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
  members: cachedOf(Members.MemberList),
  teamsPage: Teams.Model,
  teamPages: Schema.HashMap(Schema.String, Team.Model),
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
  GotTeamsPageMessage: { message: Teams.Message },
  GotTeamPageMessage: {
    teamId: Schema.String,
    message: Team.Message,
  },
  SettledLoadMe: settledWith(Me),
  SettledLoadTeams: settledWith(TeamList),
  SettledLoadTeam: { teamId: Schema.String, ...settledWith(TeamPage) },
  SettledLoadMembers: settledWith(Members.MemberList),
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

const membersSlot: Slot<Members.MemberList> = {
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

const leaveToSignIn: Step = (model) => ({
  model,
  commands: [navigate(DocumentNavigation.LeaveToSignIn())],
});

const reloadDocument: Step = (model) => ({
  model,
  commands: [navigate(DocumentNavigation.ReloadDocument())],
});

const teamHref = (teamId: string) => teamRouter({ teamId });

const openCreatedTeam =
  (maybeCreatedTeamId: Option.Option<string>): Step =>
  (model) => ({
    model,
    commands: Array.map(Array.fromOption(maybeCreatedTeamId), (teamId) =>
      navigate(DocumentNavigation.NavigateInternal({ href: teamHref(teamId) })),
    ),
  });

const leaveDeletedTeam =
  (changed: ChangedByMutation): Step =>
  (model) =>
    ChangedByMutation.guards.TeamDeleted(changed) &&
    Equal.equals(model.route, DashboardRoute.Team({ teamId: changed.teamId }))
      ? {
          model,
          commands: [
            navigate(
              DocumentNavigation.NavigateInternal({ href: teamsRouter() }),
            ),
          ],
        }
      : { model };

const reflectMutationOutcome = Mutation.OutMessage.match<Step>({
  SucceededMutation: ({ changed, maybeCreatedTeamId }) =>
    Update.combine([
      reflectChange(changed),
      openCreatedTeam(maybeCreatedTeamId),
      leaveDeletedTeam(changed),
    ]),
  RequiredSignIn: () => leaveToSignIn,
  ChangedSession: () => reloadDocument,
});

const toTeamsPageMessage = (message: Teams.Message) =>
  Message.GotTeamsPageMessage({ message });

const teamsPageChild = {
  read: (model: Model) => Option.some(model.teamsPage),
  write: (model: Model, nextTeamsPage: Teams.Model): Model =>
    modifyFields(model, { teamsPage: () => nextTeamsPage }),
  toParentMessage: toTeamsPageMessage,
};

const foldTeamsPageOutMessage = Teams.OutMessage.match<Step>({
  FinishedMutation: ({ outcome }) => reflectMutationOutcome(outcome),
  HoveredTeamLink: ({ teamId }) =>
    prefetchRoute(DashboardRoute.Team({ teamId })),
});

const foldTeamsPage = Update.foldChild({
  ...teamsPageChild,
  update: Teams.update,
  foldOutMessage: foldTeamsPageOutMessage,
});

const foldTeamsPageReset = Update.foldChildStep({
  ...teamsPageChild,
  update: Teams.resetUnlessSubmitting,
});

const UNVISITED_TEAM_PAGE = Team.init();

const teamPageOf = (model: Model, teamId: string) =>
  Option.getOrElse(
    HashMap.get(model.teamPages, teamId),
    () => UNVISITED_TEAM_PAGE,
  );

const toTeamPageMessage = (teamId: string) => (message: Team.Message) =>
  Message.GotTeamPageMessage({ teamId, message });

const foldTeamPage = (teamId: string) =>
  Update.foldChild({
    read: (model: Model) => Option.some(teamPageOf(model, teamId)),
    write: (model: Model, nextTeamPage: Team.Model): Model =>
      modifyFields(model, { teamPages: HashMap.set(teamId, nextTeamPage) }),
    toParentMessage: toTeamPageMessage(teamId),
    update: Team.update,
    foldOutMessage: Team.OutMessage.match<Step>({
      FinishedMutation: ({ outcome }) => reflectMutationOutcome(outcome),
    }),
  });

const keepOnlySubmittingTeamPages: Step = (model) => ({
  model: modifyFields(model, {
    teamPages: HashMap.filter(Team.isSubmitting),
  }),
});

const resetPages = Update.combine([
  foldTeamsPageReset,
  keepOnlySubmittingTeamPages,
]);

const changeRoute =
  (route: DashboardRoute): Step =>
  (model) =>
    Update.combine(modifyFields(model, { route: () => route }), [
      Equal.equals(route, model.route) ? unchanged : resetPages,
      enterRoute,
    ]);

const isOwnRoute = (url: Url) =>
  !DashboardRoute.guards.NotFound(urlToDashboardRoute(url));

export const init = (url: Url): UpdateReturn =>
  enterRoute({
    route: urlToDashboardRoute(url),
    me: neverLoaded(),
    teams: neverLoaded(),
    teamById: HashMap.empty(),
    members: neverLoaded(),
    teamsPage: Teams.init(),
    teamPages: HashMap.empty(),
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
    ChangedUrl: ({ url }) => changeRoute(urlToDashboardRoute(url))(model),
    HoveredLink: ({ route }) => prefetchRoute(route)(model),
    GotTeamsPageMessage: ({ message: pageMessage }) =>
      foldTeamsPage(model, pageMessage),
    GotTeamPageMessage: ({ teamId, message: pageMessage }) =>
      foldTeamPage(teamId)(model, pageMessage),
    SettledLoadMe: ({ request, result }) =>
      settleSlot(meSlot, request, result)(model),
    SettledLoadTeams: ({ request, result }) =>
      settleSlot(teamsSlot, request, result)(model),
    SettledLoadTeam: ({ teamId, request, result }) =>
      settleSlot(teamSlot(teamId), request, result)(model),
    SettledLoadMembers: ({ request, result }) =>
      settleSlot(membersSlot, request, result)(model),
    RequiredSignIn: () => leaveToSignIn(model),
    ChangedSession: () => reloadDocument(model),
  });

const ACCOUNT_SETTINGS_PATH = "/auth/account";

const navLinkView = (
  config: Readonly<{
    label: string;
    href: string;
    route: DashboardRoute;
    isCurrent: boolean;
  }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.a(
    [
      h.Href(config.href),
      h.Class(
        cn("hover:text-foreground", {
          "text-foreground": config.isCurrent,
          "text-muted-foreground": !config.isCurrent,
        }),
      ),
      ...(config.isCurrent ? [h.AriaCurrent("page")] : []),
      h.OnMouseEnter(Message.HoveredLink({ route: config.route })),
    ],
    [config.label],
  );

const navView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.nav(
    [h.Class("flex gap-4 text-sm font-medium")],
    [
      navLinkView(
        {
          label: "チーム",
          href: teamsRouter(),
          route: DashboardRoute.Teams(),
          isCurrent: DashboardRoute.isAnyOf(["Teams", "Team"])(model.route),
        },
        h,
      ),
      navLinkView(
        {
          label: "メンバー",
          href: membersRouter(),
          route: DashboardRoute.Members(),
          isCurrent: DashboardRoute.guards.Members(model.route),
        },
        h,
      ),
    ],
  );

const accountView = (me: Me, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("ml-auto flex items-center gap-4 text-sm")],
    [
      h.span([h.Class("truncate")], [me.name]),
      h.a(
        [
          h.Href(ACCOUNT_SETTINGS_PATH),
          h.Target("_blank"),
          h.Rel("noopener noreferrer"),
          h.Class("text-muted-foreground underline-offset-4 hover:underline"),
        ],
        ["設定"],
      ),
    ],
  );

const headerView = (model: Model, me: Me, h: HtmlBuilder<Message>): Html =>
  h.header(
    [h.Class("sticky top-0 z-40 border-b bg-background")],
    [
      h.div(
        [h.Class("mx-auto flex h-14 max-w-5xl items-center gap-6 px-4")],
        [
          h.a(
            [
              h.Href(teamsRouter()),
              h.Class("text-lg font-bold text-brand"),
              h.OnMouseEnter(
                Message.HoveredLink({ route: DashboardRoute.Teams() }),
              ),
            ],
            [SERVICE_NAME],
          ),
          navView(model, h),
          accountView(me, h),
        ],
      ),
    ],
  );

const pageView = (model: Model, me: Me, h: HtmlBuilder<Message>): Html =>
  DashboardRoute.match(model.route, {
    Home: () => h.empty,
    Teams: () =>
      h.submodel({
        slotId: "teams-page",
        view: Teams.view,
        model: model.teamsPage,
        viewInputs: {
          canManage: me.canManage,
          teams: model.teams.data,
          teamHref,
        },
        toParentMessage: toTeamsPageMessage,
      }),
    Team: ({ teamId }) =>
      h.submodel({
        slotId: `team-page-${teamId}`,
        view: Team.view,
        model: teamPageOf(model, teamId),
        viewInputs: {
          teamId,
          myUserId: me.userId,
          canManage: me.canManage,
          team: teamSlot(teamId).read(model).data,
          teamsHref: teamsRouter(),
        },
        toParentMessage: toTeamPageMessage(teamId),
      }),
    Members: () => Members.view(model.members.data, h),
    NotFound: () => h.p([], ["Not Found"]),
  });

const frameView = (model: Model, me: Me, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("flex min-h-screen flex-col")],
    [
      headerView(model, me, h),
      h.main(
        [h.Class("mx-auto w-full max-w-5xl flex-1 p-6 md:p-12")],
        [pageView(model, me, h)],
      ),
      h.footer(
        [h.Class("mx-auto w-full max-w-5xl px-6 py-4")],
        [
          h.a(
            [
              h.Href(privacyRouter()),
              h.Class(
                "text-xs text-muted-foreground underline underline-offset-4",
              ),
            ],
            ["プライバシーポリシー"],
          ),
        ],
      ),
    ],
  );

export const view = (model: Model, h: HtmlBuilder<Message>): Document => ({
  title: SERVICE_NAME,
  body: AsyncData.matchData(model.me.data, {
    onEmpty: () => h.empty,
    onFailure: (failureMessage) =>
      h.main(
        [
          h.Class(
            "mx-auto max-w-5xl p-6 text-sm text-muted-foreground md:p-12",
          ),
        ],
        [failureMessage],
      ),
    onData: (me) => frameView(model, me, h),
  }),
});
