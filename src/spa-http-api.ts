import type { Member } from "@taimei-code/auth-client";
import {
  Context,
  Effect,
  ErrorReporter,
  Layer,
  Match,
  Record,
  Result,
} from "effect";
// biome-ignore lint/style/noRestrictedImports: 契約を Hono に載せる file だけが web handler を組む (ADR-0007)
import { HttpRouter, HttpServer } from "effect/http";
import {
  HttpApiBuilder,
  type HttpApiEndpoint,
  HttpApiError,
  type HttpApiGroup,
} from "effect/http-api";
import { reportError } from "@/src/lib/report-error";
import {
  runServiceWithoutDb,
  runTeamManagement,
  runTeamReads,
  runTeamService,
} from "@/src/services";
import { isManager } from "@/src/services/authorization-context";
import { CompanyMembers } from "@/src/services/company-members-service";
import {
  defectOf,
  isUnexpectedFailure,
  type TeamFailure,
  type UnexpectedFailure,
} from "@/src/services/failures";
import type { RequestSession } from "@/src/services/request-session";
import {
  Authenticated,
  CurrentSession,
  ManagerOnly,
  type MeGroup,
  type MembersGroup,
  MyLevelsGroup,
  NotManager,
  type SessionChanged,
  SpaApi,
  TeamManagementGroup,
  TeamsGroup,
  Unauthenticated,
} from "@/src/spa-contract";

export type SessionCheck = Result.Result<
  RequestSession,
  Unauthenticated | SessionChanged
>;

// middleware の要求は layer を組む時にしか満たせないので、要求ごとの値は Reference で渡す
const SessionCheckRef = Context.Reference<SessionCheck>("taimei/SessionCheck", {
  defaultValue: () => Result.fail(new Unauthenticated()),
});

const AuthenticatedLive = Layer.succeed(Authenticated, (httpEffect) =>
  Effect.gen(function* () {
    const session = yield* Effect.fromResult(yield* SessionCheckRef);
    return yield* Effect.provideService(httpEffect, CurrentSession, session);
  }),
);

const ManagerOnlyLive = Layer.succeed(ManagerOnly, (httpEffect) =>
  Effect.gen(function* () {
    const session = yield* CurrentSession;
    if (!isManager(session.role)) return yield* new NotManager();
    return yield* httpEffect;
  }),
);

type EndpointInput<E> = Omit<
  HttpApiEndpoint.Request<E>,
  "request" | "endpoint" | "group"
>;

type DecodedHandlers<Group> = {
  readonly [E in HttpApiGroup.Endpoints<Group> as HttpApiEndpoint.Identifier<E>]: (
    input: EndpointInput<E>,
  ) => Effect.Effect<
    HttpApiEndpoint.Success<E>["Type"],
    HttpApiEndpoint.Error<E>["Type"] | HttpApiEndpoint.MiddlewareError<E>,
    CurrentSession
  >;
};

const runServiceForCurrentSession = <A, E extends TeamFailure>(
  run: (session: RequestSession) => Promise<Result.Result<A, E>>,
) =>
  CurrentSession.use((session) => Effect.promise(() => run(session))).pipe(
    Effect.flatMap(Effect.fromResult),
    Effect.catchIf(
      (failure): failure is Extract<E, UnexpectedFailure> =>
        isUnexpectedFailure(failure),
      (failure) => Effect.die(defectOf(failure)),
    ),
  );

type EmptySuccess = { readonly [key: string]: never };

type HandlerSuccess<E> = HttpApiEndpoint.Success<E>["Type"] extends EmptySuccess
  ? void
  : HttpApiEndpoint.Success<E>["Type"];

type ServiceHandlers<Group, Service, R> = {
  readonly [E in HttpApiGroup.Endpoints<Group> as HttpApiEndpoint.Identifier<E>]: (
    service: Service,
    input: EndpointInput<E>,
  ) => Effect.Effect<
    HandlerSuccess<E>,
    HttpApiEndpoint.Error<E>["Type"] | UnexpectedFailure,
    R
  >;
};

type AnyRun = (session: RequestSession, use: never) => Promise<unknown>;

type UseOf<Run extends AnyRun> = Parameters<Run>[1];

type ServiceOf<Run extends AnyRun> = Parameters<UseOf<Run>>[0];

type RequirementsOf<Run extends AnyRun> =
  ReturnType<UseOf<Run>> extends Effect.Effect<unknown, unknown, infer R>
    ? R
    : never;

type UntypedRun = (
  session: RequestSession,
  use: (service: unknown) => Effect.Effect<unknown, TeamFailure, unknown>,
) => Promise<Result.Result<unknown, TeamFailure>>;

type UntypedHandler = (
  service: unknown,
  input: unknown,
) => Effect.Effect<unknown, TeamFailure, unknown>;

const handledByUntyped = (
  _group: unknown,
  run: UntypedRun,
  handlers: { readonly [name: string]: UntypedHandler },
) =>
  Record.map(
    handlers,
    (handler) => (input: unknown) =>
      runServiceForCurrentSession((session) =>
        run(session, (service) =>
          handler(service, input).pipe(Effect.map((value) => value ?? {})),
        ),
      ),
  );

export const handledBy = handledByUntyped as unknown as <
  Group,
  Run extends AnyRun,
>(
  group: Group,
  run: Run,
  handlers: NoInfer<
    ServiceHandlers<Group, ServiceOf<Run>, RequirementsOf<Run>>
  >,
) => DecodedHandlers<Group>;

const memberName = ({ name, email }: Member) => name.trim() || email;

const teamMembersOrNullWhenListFails = CompanyMembers.use(
  (members) => members.list,
).pipe(
  Effect.map((members) =>
    members.map((member) => ({
      userId: member.userId,
      name: memberName(member),
    })),
  ),
  Effect.catchTag("MemberListError", (failure) =>
    Effect.sync(() => reportError(defectOf(failure))).pipe(Effect.as(null)),
  ),
);

const handlers: {
  readonly me: DecodedHandlers<typeof MeGroup>;
  readonly teams: DecodedHandlers<typeof TeamsGroup>;
  readonly myLevels: DecodedHandlers<typeof MyLevelsGroup>;
  readonly teamManagement: DecodedHandlers<typeof TeamManagementGroup>;
  readonly members: DecodedHandlers<typeof MembersGroup>;
} = {
  me: {
    get: () =>
      CurrentSession.useSync((session) => ({
        userId: session.userId,
        name: session.userName,
        canManage: isManager(session.role),
      })),
  },
  teams: handledBy(TeamsGroup, runTeamReads, {
    list: (reads) => reads.listTeams.pipe(Effect.map((teams) => ({ teams }))),
    get: (reads, { params }) =>
      Effect.all(
        {
          team: reads.getTeam(params.teamId),
          members: teamMembersOrNullWhenListFails,
        },
        { concurrency: "unbounded" },
      ),
  }),
  myLevels: handledBy(MyLevelsGroup, runTeamService, {
    saveMyLevels: (teams, { params, payload }) =>
      teams.saveMyLevels(params.teamId, payload.levels),
  }),
  teamManagement: handledBy(TeamManagementGroup, runTeamManagement, {
    create: (management, { payload }) => management.createTeam(payload.name),
    rename: (management, { params, payload }) =>
      management.renameTeam(params.teamId, payload.name),
    delete: (management, { params }) => management.deleteTeam(params.teamId),
    addSkill: (management, { params, payload }) =>
      management.addSkill(params.teamId, payload.name),
    removeSkill: (management, { params }) =>
      management.removeSkill(params.skillId),
    assign: (management, { params }) =>
      management.assign(params.teamId, params.userId),
    unassign: (management, { params }) =>
      management.unassign(params.teamId, params.userId),
  }),
  members: {
    list: () =>
      runServiceForCurrentSession((session) =>
        runServiceWithoutDb(session, () =>
          CompanyMembers.use((companyMembers) => companyMembers.list).pipe(
            Effect.map((members) => ({
              members: members.map((member) => ({
                name: memberName(member),
                email: member.email,
                ...(member.role && { role: member.role }),
              })),
            })),
          ),
        ),
      ),
  },
};

const isResponseEncodeFailure = (error: unknown) =>
  HttpApiError.HttpApiSchemaError.is(error) && !ErrorReporter.isIgnored(error);

const unexpectedFailureReporter: ErrorReporter.ErrorReporter = {
  [ErrorReporter.TypeId]: ErrorReporter.TypeId,
  report: ({ cause }) => {
    for (const reason of cause.reasons)
      Match.valueTags(reason, {
        Die: ({ defect }) => reportError(defect),
        Fail: ({ error }) => {
          if (isResponseEncodeFailure(error)) reportError(error);
        },
        Interrupt: () => {},
      });
  },
};

export const SpaApiLive = HttpApiBuilder.layer(SpaApi).pipe(
  Layer.provide([
    HttpApiBuilder.group(SpaApi, "me", (h) => h.handleAll(handlers.me)),
    HttpApiBuilder.group(SpaApi, "teams", (h) => h.handleAll(handlers.teams)),
    HttpApiBuilder.group(SpaApi, "myLevels", (h) =>
      h.handleAll(handlers.myLevels),
    ),
    HttpApiBuilder.group(SpaApi, "teamManagement", (h) =>
      h.handleAll(handlers.teamManagement),
    ),
    HttpApiBuilder.group(SpaApi, "members", (h) =>
      h.handleAll(handlers.members),
    ),
  ]),
  Layer.provide([AuthenticatedLive, ManagerOnlyLive]),
  Layer.provide(ErrorReporter.layer([unexpectedFailureReporter])),
  Layer.provide(HttpServer.layerServices),
);

const webHandlerOf = (live: typeof SpaApiLive) =>
  HttpRouter.toWebHandler(live, { disableLogger: true }).handler;

export const spaApiResponder = (live = SpaApiLive) => {
  let respond: ReturnType<typeof webHandlerOf> | undefined;
  return (request: Request, check: SessionCheck) => {
    respond ??= webHandlerOf(live);
    return respond(request, Context.make(SessionCheckRef, check));
  };
};
