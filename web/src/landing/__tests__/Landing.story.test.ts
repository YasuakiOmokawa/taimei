import { Option } from "effect";
import { given, message, model, story } from "foldkit/story";
import { expect, it } from "vitest";
import { init, Message, update } from "../pages/Landing";

it("メニューを閉じた状態で始まり、今年を読む Command を出す", () => {
  const started = init();

  expect(started.model).toEqual({
    isMenuOpen: false,
    maybeCurrentYear: Option.none(),
  });
  expect(started.commands?.map((command) => command.name)).toEqual([
    "ReadCurrentYear",
  ]);
});

it("読んだ年を Model に入れる", () => {
  story(
    update,
    given(init().model),
    message(Message.CompletedReadCurrentYear({ year: 2026 })),
    model((next) => {
      expect(next.maybeCurrentYear).toEqual(Option.some(2026));
    }),
  );
});
