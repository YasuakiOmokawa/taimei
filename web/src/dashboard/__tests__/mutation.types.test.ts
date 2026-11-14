import { Option, Schema } from "effect";
import { Update } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import { modifyFields } from "foldkit/struct";
import { expect, it } from "vitest";
import { SkillId } from "../../../../db/ids";
import { ChangedByMutation } from "../changed-by-mutation";
import * as Mutation from "../mutation";

const Page = Schema.Struct({ creation: Mutation.Model });
type Page = typeof Page.Type;

const PageMessage = defineMessageUnion({
  GotCreationMessage: { message: Mutation.Message },
});
type PageMessage = typeof PageMessage.Type;

const creationChild = {
  read: (page: Page) => Option.some(page.creation),
  write: (page: Page, nextCreation: Mutation.Model): Page =>
    modifyFields(page, { creation: () => nextCreation }),
  toParentMessage: (message: Mutation.Message) =>
    PageMessage.GotCreationMessage({ message }),
};

it("更新の成功は、何を変えたかの宣言を省けない (bun run typecheck で見る)", () => {
  const withoutChanged = () =>
    // @ts-expect-error changed が無いと、成功の後にどの cache を古くするかが決まらない
    Mutation.Message.SucceededMutation({ maybeCreatedTeamId: Option.none() });

  expect(withoutChanged).toBeDefined();
});

it("更新の結果を受け取らない fold は書けない (bun run typecheck で見る)", () => {
  const dropping = Update.foldChild({
    ...creationChild,
    // @ts-expect-error 更新の update は OutMessage を返すので、foldOutMessage か toParentOutMessage が要る
    update: Mutation.update,
  });

  expect(dropping).toBeDefined();
});

it("更新の Command は、そのままでは page の Command として返せない (bun run typecheck で見る)", () => {
  const bypassing = (page: Page): Update.Return<Page, PageMessage> => ({
    model: page,
    // @ts-expect-error 更新の Command の結果は Mutation の Message で、page の Message ではない。page は submit* を fold する
    commands: [Mutation.CreateTeam({ name: "開発" })],
  });

  expect(bypassing).toBeDefined();
});

it("更新の結果を受け取る fold は書ける (bun run typecheck で見る)", () => {
  const receiving = Update.foldChild({
    ...creationChild,
    update: Mutation.update,
    foldOutMessage: Mutation.OutMessage.match<Update.Step<Page, PageMessage>>({
      SucceededMutation: () => (page) => ({ model: page }),
      RequiredSignIn: () => (page) => ({ model: page }),
      ChangedSession: () => (page) => ({ model: page }),
    }),
  });

  expect(
    receiving(
      { creation: Mutation.init() },
      Mutation.Message.SucceededMutation({
        changed: ChangedByMutation.TeamList(),
        maybeCreatedTeamId: Option.none(),
      }),
    ).model.creation,
  ).toEqual(Mutation.init());
});

it("保存の level に文字列を渡すと型エラーになる (bun run typecheck で見る)", () => {
  const withStringLevel = () =>
    Mutation.SaveMyLevels({
      teamId: "t_1",
      myUserId: "u_1",
      entries: [
        {
          skillId: SkillId.make("00000000-0000-4000-8000-000000000a01"),
          // @ts-expect-error level は 0〜3 の数で、select の値の文字列のままでは送れない
          level: "2",
          wantsToLearn: false,
        },
      ],
    });

  expect(withStringLevel).toBeDefined();
});
