import type { HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { Menu } from "lucide";
import { expect, test } from "vitest";
import { Submission } from "../../submission";
import { buttonView } from "../button-view";

const Message = defineMessageUnion({ ClickedRemove: {} });
type Message = typeof Message.Type;

const idleSaveButton = {
  look: "primarySmall",
  label: "保存",
  submission: Submission.Idle(),
  isBlocked: false,
} as const;

const clickButtonWithoutOnClick = (h: HtmlBuilder<Message>) =>
  // @ts-expect-error type が button の button は、押した時の Message を必ず受け取る
  buttonView({ ...idleSaveButton, type: "button" }, h);

const submitButtonWithOnClick = (h: HtmlBuilder<Message>) =>
  buttonView(
    {
      ...idleSaveButton,
      type: "submit",
      // @ts-expect-error type が submit の button は form の送信だけを流し、click の Message を持てない
      onClick: Message.ClickedRemove(),
    },
    h,
  );

const buttonWithoutSubmission = (h: HtmlBuilder<Message>) =>
  buttonView(
    // @ts-expect-error 送信の button は、送信中かどうか (submission) を必ず受け取る
    { look: "primarySmall", type: "submit", label: "保存", isBlocked: false },
    h,
  );

const buttonWithoutIsBlocked = (h: HtmlBuilder<Message>) =>
  buttonView(
    // @ts-expect-error 送信の button は、止められているかどうか (isBlocked) を必ず受け取る
    {
      look: "primarySmall",
      type: "submit",
      label: "保存",
      submission: Submission.Idle(),
    },
    h,
  );

const iconButtonWithSubmission = (h: HtmlBuilder<Message>) =>
  buttonView(
    {
      look: "ghostIconBelowMd",
      label: "メニュー",
      icon: Menu,
      onClick: Message.ClickedRemove(),
      // @ts-expect-error 無効にならない look (LP のメニュー) は submission を受け取れない
      submission: Submission.Idle(),
    },
    h,
  );

const submitButton = (h: HtmlBuilder<Message>) =>
  buttonView({ ...idleSaveButton, type: "submit" }, h);

const clickButton = (h: HtmlBuilder<Message>) =>
  buttonView(
    { ...idleSaveButton, type: "button", onClick: Message.ClickedRemove() },
    h,
  );

test("button の部品は、送信中の扱いと、type に合う click の有無を config の型で決めさせる (typecheck で検査する)", () => {
  expect([
    clickButtonWithoutOnClick,
    submitButtonWithOnClick,
    buttonWithoutSubmission,
    buttonWithoutIsBlocked,
    iconButtonWithSubmission,
    submitButton,
    clickButton,
  ]).toHaveLength(7);
});
