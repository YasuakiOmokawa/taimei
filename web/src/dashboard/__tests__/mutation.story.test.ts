import { type Effect, ManagedRuntime, Option } from "effect";
import type { CommandDefinition } from "foldkit/command";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SkillId } from "../../../../db/ids";
import { SESSION_HEADER } from "../../../../src/spa-contract";
import { SpaHttpClient } from "../../shared/spa-http-client";
import { Submission } from "../../shared/submission";
import { ChangedByMutation } from "../changed-by-mutation";
import * as Mutation from "../mutation";

const ORIGIN = "https://app.example.com";
const CREATED_TEAM_ID = "00000000-0000-4000-8000-0000000000cc";
const TEAM_ID = "00000000-0000-4000-8000-0000000000aa";
const SKILL_ID = SkillId.make("00000000-0000-4000-8000-000000000a01");
const MY_USER_ID = "u_1";
const ENTRIES = [{ skillId: SKILL_ID, level: 2 as const, wantsToLearn: true }];

const startClient = () => ManagedRuntime.make(SpaHttpClient.layer(ORIGIN));

const create = (name: string, runtime = startClient()) =>
  runtime.runPromise(Mutation.CreateTeam({ name }).effect);

const save = (teamId = TEAM_ID, runtime = startClient()) =>
  runtime.runPromise(
    Mutation.SaveMyLevels({ teamId, myUserId: MY_USER_ID, entries: ENTRIES })
      .effect,
  );

const replyWith = (body: unknown, init_?: ResponseInit) => {
  const fetch = vi.fn<typeof globalThis.fetch>(async () =>
    Response.json(body, init_),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
};

const jsonOf = (body: RequestInit["body"]): unknown =>
  JSON.parse(
    body instanceof Uint8Array ? new TextDecoder().decode(body) : String(body),
  );

const rejected = (rejection: string) =>
  Mutation.Message.FailedMutation({ message: rejection });

afterEach(() => {
  vi.unstubAllGlobals();
});

const answerConfirmation = (isConfirmed: boolean) => {
  const confirm = vi.fn((_message: string) => isConfirmed);
  vi.stubGlobal("window", { confirm });
  return confirm;
};

const CONFIRMATION = "消します。";

const run = <Settled>(
  command: Readonly<{ effect: Effect.Effect<Settled, never, SpaHttpClient> }>,
  runtime = startClient(),
) => runtime.runPromise(command.effect);

const rename = (teamId = TEAM_ID) =>
  Mutation.RenameTeam({ teamId, name: "営業" });
const addSkill = (teamId = TEAM_ID) =>
  Mutation.AddSkill({ teamId, name: "テスト" });
const assign = (teamId = TEAM_ID, userId = "u_4") =>
  Mutation.AssignMember({ teamId, userId });
const removeSkill = (skillId: string = SKILL_ID) =>
  Mutation.RemoveSkill({
    teamId: TEAM_ID,
    skillId,
    confirmation: CONFIRMATION,
    restoredOnCancel: Submission.Idle(),
  });
const unassign = (teamId = TEAM_ID, userId = "u_3") =>
  Mutation.UnassignMember({
    teamId,
    userId,
    confirmation: CONFIRMATION,
    restoredOnCancel: Submission.Idle(),
  });
const deleteTeam = (teamId = TEAM_ID) =>
  Mutation.DeleteTeam({
    teamId,
    confirmation: CONFIRMATION,
    restoredOnCancel: Submission.Idle(),
  });

const teamChanged = Mutation.Message.SucceededMutation({
  changed: ChangedByMutation.Team({ teamId: TEAM_ID }),
  maybeCreatedTeamId: Option.none(),
});

describe("チームの作成の Command", () => {
  it("成功すると、一覧を変えたことと、応答の id を返す", async () => {
    replyWith({ id: CREATED_TEAM_ID });

    await expect(create("開発")).resolves.toEqual(
      Mutation.Message.SucceededMutation({
        changed: ChangedByMutation.TeamList(),
        maybeCreatedTeamId: Option.some(CREATED_TEAM_ID),
      }),
    );
  });

  it.each([
    [
      "契約の失敗 (名前の重複)",
      { _tag: "DuplicateName" },
      409,
      "同じ名前がすでにあります",
    ],
    ["契約の外の失敗", {}, 500, "チームを作れませんでした"],
  ])("%s は、その文言の失敗を返す", async (_, body, status, rejection) => {
    replyWith(body, { status });

    await expect(create("開発")).resolves.toEqual(rejected(rejection));
  });

  it("同じ endpoint の更新を 2 つの画面の部品から同時に流しても、互いを中断せず、それぞれの結果で解決する", async () => {
    const posts: Array<PromiseWithResolvers<Response>> = [];
    const fetch = vi.fn<typeof globalThis.fetch>(() => {
      const post = Promise.withResolvers<Response>();
      posts.push(post);
      return post.promise;
    });
    vi.stubGlobal("fetch", fetch);

    const settled = Promise.all([create("開発"), create("営業")]);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    posts[0]?.resolve(Response.json({ id: "t_a" }));
    posts[1]?.resolve(Response.json({ id: "t_b" }));

    expect(
      (await settled).map((result) =>
        Mutation.Message.match(result, {
          SucceededMutation: ({ maybeCreatedTeamId }) =>
            Option.getOrUndefined(maybeCreatedTeamId),
          FailedMutation: () => undefined,
          CanceledMutation: () => undefined,
          RequiredSignIn: () => undefined,
          ChangedSession: () => undefined,
        }),
      ),
    ).toEqual(["t_a", "t_b"]);
  });
});

describe("自分のレベルの保存の Command", () => {
  it("成功すると、そのチームの自分のレベルを送った値に変えたことを返し、新しいチームの id は持たない", async () => {
    replyWith({});

    await expect(save()).resolves.toEqual(
      Mutation.Message.SucceededMutation({
        changed: ChangedByMutation.MyLevels({
          teamId: TEAM_ID,
          myUserId: MY_USER_ID,
          entries: ENTRIES,
        }),
        maybeCreatedTeamId: Option.none(),
      }),
    );
  });

  it("保存は、送った値を body の levels に入れて PUT する", async () => {
    const fetch = replyWith({});

    await save();

    const [input, init_] = fetch.mock.calls[0] ?? [];
    expect(init_?.method).toBe("PUT");
    expect(String(input)).toBe(`${ORIGIN}/api/teams/${TEAM_ID}/my-levels`);
    expect(jsonOf(init_?.body)).toEqual({ levels: ENTRIES });
  });

  it("保存は path の param を escape して path に入れる", async () => {
    const fetch = replyWith({});

    await save("a/b?c");

    expect(new URL(String(fetch.mock.calls[0]?.[0])).pathname).toBe(
      "/api/teams/a%2Fb%3Fc/my-levels",
    );
  });

  it.each([
    [
      "契約の失敗 (割り当てられていない)",
      { _tag: "NotAssigned" },
      403,
      "チームに割り当てられた人だけが記入できます",
    ],
    ["契約の外の失敗", {}, 500, "保存できませんでした"],
  ])("%s は、その文言の失敗を返す", async (_, body, status, rejection) => {
    replyWith(body, { status });

    await expect(save()).resolves.toEqual(rejected(rejection));
  });
});

describe("チームの管理の Command", () => {
  it.each([
    [
      "名前の変更",
      () => rename(),
      "PATCH",
      `/api/teams/${TEAM_ID}`,
      { name: "営業" },
    ],
    [
      "スキルの追加",
      () => addSkill(),
      "POST",
      `/api/teams/${TEAM_ID}/skills`,
      { name: "テスト" },
    ],
    [
      "割り当て",
      () => assign(),
      "PUT",
      `/api/teams/${TEAM_ID}/assignments/u_4`,
      undefined,
    ],
    [
      "スキルの削除",
      () => removeSkill(),
      "DELETE",
      `/api/skills/${SKILL_ID}`,
      undefined,
    ],
    [
      "外すこと",
      () => unassign(),
      "DELETE",
      `/api/teams/${TEAM_ID}/assignments/u_3`,
      undefined,
    ],
  ] as const)(
    "%s は、その endpoint に送り、成功するとそのチームを変えたことを返す",
    async (_, command, method, path, body) => {
      answerConfirmation(true);
      const fetch = replyWith({});

      await expect(run(command())).resolves.toEqual(teamChanged);

      const [input, init_] = fetch.mock.calls[0] ?? [];
      expect(init_?.method).toBe(method);
      expect(new URL(String(input)).pathname).toBe(path);
      if (body !== undefined) {
        expect(jsonOf(init_?.body)).toEqual(body);
      }
    },
  );

  it("チームの削除は DELETE を送り、成功するとそのチームを消したことを返す", async () => {
    const confirm = answerConfirmation(true);
    const fetch = replyWith({});

    await expect(run(deleteTeam())).resolves.toEqual(
      Mutation.Message.SucceededMutation({
        changed: ChangedByMutation.TeamDeleted({ teamId: TEAM_ID }),
        maybeCreatedTeamId: Option.none(),
      }),
    );
    expect(confirm).toHaveBeenCalledWith(CONFIRMATION);
    expect(fetch.mock.calls[0]?.[1]?.method).toBe("DELETE");
  });

  it.each([
    ["スキルの削除", () => removeSkill()],
    ["外すこと", () => unassign()],
    ["チームの削除", () => deleteTeam()],
  ])(
    "%s は確認を取り消すと、要求を送らず、送信の前の状態に戻すことを返す",
    async (_, command) => {
      answerConfirmation(false);
      const fetch = replyWith({});

      await expect(run(command())).resolves.toEqual(
        Mutation.Message.CanceledMutation({ restored: Submission.Idle() }),
      );
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      "名前の変更",
      () => rename(),
      { _tag: "DuplicateName" },
      409,
      "同じ名前がすでにあります",
    ],
    ["名前の変更", () => rename(), {}, 500, "名前を変えられませんでした"],
    ["スキルの追加", () => addSkill(), {}, 500, "スキルを足せませんでした"],
    [
      "割り当て",
      () => assign(),
      { _tag: "NotCompanyMember", userId: "u_4" },
      422,
      "事業所のメンバーではありません",
    ],
    ["割り当て", () => assign(), {}, 500, "割り当てられませんでした"],
    [
      "スキルの削除",
      () => removeSkill(),
      {},
      500,
      "スキルを削除できませんでした",
    ],
    ["外すこと", () => unassign(), {}, 500, "外せませんでした"],
    [
      "チームの削除",
      () => deleteTeam(),
      {},
      500,
      "チームを削除できませんでした",
    ],
  ])(
    "%s の失敗 (%j) は、その文言の失敗を返す",
    async (_, command, body, status, rejection) => {
      answerConfirmation(true);
      replyWith(body, { status });

      await expect(run(command())).resolves.toEqual(rejected(rejection));
    },
  );

  it.each([
    ["名前の変更", () => rename("../members"), "/api/teams/..%2Fmembers"],
    ["削除", () => deleteTeam("../members"), "/api/teams/..%2Fmembers"],
    [
      "スキルの追加",
      () => addSkill("../members"),
      "/api/teams/..%2Fmembers/skills",
    ],
    ["スキルの削除", () => removeSkill("../me"), "/api/skills/..%2Fme"],
    [
      "割り当て",
      () => assign("../members", "a/b"),
      "/api/teams/..%2Fmembers/assignments/a%2Fb",
    ],
    [
      "外す",
      () => unassign("../members", "a/b"),
      "/api/teams/..%2Fmembers/assignments/a%2Fb",
    ],
  ])(
    "%s は path の param を escape して path に入れる",
    async (_, command, path) => {
      answerConfirmation(true);
      const fetch = replyWith({});

      await run(command());

      expect(new URL(String(fetch.mock.calls[0]?.[0])).pathname).toBe(path);
    },
  );
});

type MutationCommandName = {
  [Name in keyof typeof Mutation]: (typeof Mutation)[Name] extends CommandDefinition
    ? Name
    : never;
}[keyof typeof Mutation];

const SEND_BY_COMMAND: Record<
  MutationCommandName,
  (runtime: ReturnType<typeof startClient>) => Promise<Mutation.Message>
> = {
  CreateTeam: (runtime) => create("開発", runtime),
  SaveMyLevels: (runtime) => save(TEAM_ID, runtime),
  RenameTeam: (runtime) => run(rename(), runtime),
  AddSkill: (runtime) => run(addSkill(), runtime),
  AssignMember: (runtime) => run(assign(), runtime),
  RemoveSkill: (runtime) => run(removeSkill(), runtime),
  UnassignMember: (runtime) => run(unassign(), runtime),
  DeleteTeam: (runtime) => run(deleteTeam(), runtime),
};

describe.each(Object.entries(SEND_BY_COMMAND))(
  "どの更新の Command も (%s)",
  (_, send) => {
    beforeEach(() => {
      answerConfirmation(true);
    });

    it("401 は、ログインが要ることを返す", async () => {
      replyWith({ _tag: "Unauthenticated" }, { status: 401 });

      await expect(send(startClient())).resolves.toEqual(
        Mutation.Message.RequiredSignIn(),
      );
    });

    it("応答の session の印が最初の応答と違うと、session が変わったことを返す", async () => {
      const marked = startClient();
      const marks = ["company_a u_1", "company_b u_1"];
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          Response.json(
            { id: CREATED_TEAM_ID },
            { headers: { [SESSION_HEADER]: marks.shift() ?? "" } },
          ),
        ),
      );
      await send(marked);

      await expect(send(marked)).resolves.toEqual(
        Mutation.Message.ChangedSession(),
      );
    });
  },
);
