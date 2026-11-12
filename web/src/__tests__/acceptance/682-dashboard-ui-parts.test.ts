import { spawnSync } from "node:child_process";
import path from "node:path";
import { Schema } from "effect";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import {
  all,
  change,
  click,
  expectAll,
  expect as expectInScene,
  given,
  label,
  role,
  scene,
  selector,
  text,
  type as typeInto,
} from "foldkit/scene";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");

const BUTTON_BASE_CLASS_OF_REACT_SMALL =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";
const ARIA_DISABLED_CLASS =
  "aria-disabled:pointer-events-none aria-disabled:opacity-50";
const SUBMIT_BUTTON_CLASS_OF_REACT_DASHBOARD = `${BUTTON_BASE_CLASS_OF_REACT_SMALL} bg-primary text-primary-foreground hover:bg-primary/90 h-9 rounded-md px-3`;
const REMOVE_BUTTON_CLASS_OF_REACT_DASHBOARD = `${BUTTON_BASE_CLASS_OF_REACT_SMALL} border border-input bg-background h-9 rounded-md px-3 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive`;
const INVITE_LINK_CLASS_OF_REACT_DASHBOARD = `${BUTTON_BASE_CLASS_OF_REACT_SMALL} border border-input bg-background hover:bg-accent hover:text-accent-foreground h-9 rounded-md px-3`;
const CARD_CLASS_OF_REACT_DASHBOARD =
  "rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden";
const CARD_MESSAGE_CLASS_OF_REACT_DASHBOARD =
  "px-6 py-10 text-center text-sm text-muted-foreground";
const NAME_FIELD_CLASS_OF_REACT_DASHBOARD =
  "w-full max-w-xs rounded-md border-input text-sm";
const LEVEL_SELECT_CLASS_OF_REACT_DASHBOARD =
  "rounded-md border-input font-symbol text-sm";
const CHECKBOX_CLASS_OF_REACT_DASHBOARD =
  "size-4 rounded border-input text-primary focus:ring-ring";
const FAILURE_ALERT_CLASS_OF_REACT_DASHBOARD = "text-sm text-destructive";

const BUTTON_BASE_CLASS_OF_LANDING =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0";
const MENU_BUTTON_CLASS_OF_LANDING = `${BUTTON_BASE_CLASS_OF_LANDING} hover:bg-accent hover:text-accent-foreground h-10 w-10 md:hidden`;
const TRY_LINK_CLASS_OF_LANDING =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 h-11 rounded-md text-base px-8 py-6";
const DETAIL_LINK_CLASS_OF_LANDING =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 text-primary underline-offset-4 hover:underline h-11 rounded-md px-8 mt-2";

const gitGrepLines = (pattern: string, ...pathspecs: readonly string[]) => {
  const result = spawnSync(
    "git",
    ["grep", "--untracked", "-n", "-E", pattern, "--", ...pathspecs],
    { cwd: REPO_ROOT, encoding: "utf8" },
  );
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`git grep ${pattern}: ${result.stderr}`);
  }
  return result.stdout.split("\n").filter((line) => line !== "");
};

const PartMessage = defineMessageUnion({
  TypedName: { value: Schema.String },
  SelectedOption: { value: Schema.String },
  ToggledWantsToLearn: { isChecked: Schema.Boolean },
  ClickedRemove: {},
});
type PartMessage = typeof PartMessage.Type;

type PartModel = Readonly<{
  name: string;
  selected: string;
  wantsToLearn: boolean;
  removeClicks: number;
}>;

const untouched: PartModel = {
  name: "",
  selected: "1",
  wantsToLearn: false,
  removeClicks: 0,
};

const reflectPartMessage = (current: PartModel, message: PartMessage) => ({
  model: PartMessage.match(message, {
    TypedName: ({ value }): PartModel => ({ ...current, name: value }),
    SelectedOption: ({ value }): PartModel => ({ ...current, selected: value }),
    ToggledWantsToLearn: ({ isChecked }): PartModel => ({
      ...current,
      wantsToLearn: isChecked,
    }),
    ClickedRemove: (): PartModel => ({
      ...current,
      removeClicks: current.removeClicks + 1,
    }),
  }),
});

const viewOfParts =
  (
    parts: (
      current: PartModel,
      h: HtmlBuilder<PartMessage>,
    ) => ReadonlyArray<Html>,
  ) =>
  (current: PartModel, h: HtmlBuilder<PartMessage>): Html =>
    h.div(
      [],
      [
        ...parts(current, h),
        h.p([], [`名前の値「${current.name}」`]),
        h.p([], [`選んだ値「${current.selected}」`]),
        h.p([], [`学びたい「${current.wantsToLearn ? "はい" : "いいえ"}」`]),
        h.p([], [`削除を押した回数 ${current.removeClicks}`]),
      ],
    );

const sceneOfParts = (
  parts: (
    current: PartModel,
    h: HtmlBuilder<PartMessage>,
  ) => ReadonlyArray<Html>,
) => ({ update: reflectPartMessage, view: viewOfParts(parts) });

describe("#682 dashboard が使う UI 部品: card と文言", () => {
  it("AC-001 card の部品は、渡された中身を今の React の card と同じ class の要素の中に描く", async () => {
    const { cardView } = await import("../../shared/ui/card-view");

    scene(
      sceneOfParts((_, h) => [
        cardView([h.h2([], ["星取表"]), h.span([], ["card の中身"])], h),
      ]),
      given(untouched),
      expectInScene(selector(".shadow-sm")).toHaveAttr(
        "class",
        CARD_CLASS_OF_REACT_DASHBOARD,
      ),
      expectInScene(selector(".shadow-sm h2")).toHaveText("星取表"),
      expectInScene(selector(".shadow-sm span")).toHaveText("card の中身"),
    );
  });

  it("AC-002 card の中の文言の部品は、渡された文言を今の React の空の時の文言と同じ class で描く", async () => {
    const { cardMessageView } = await import("../../shared/ui/card-view");

    scene(
      sceneOfParts((_, h) => [cardMessageView("スキルがありません", h)]),
      given(untouched),
      expectInScene(text("スキルがありません")).toHaveAttr(
        "class",
        CARD_MESSAGE_CLASS_OF_REACT_DASHBOARD,
      ),
    );
  });

  it("AC-003 読み込み中の文言の部品は、読み込み中であることを status の役割の要素に描く", async () => {
    const { cardLoadingView } = await import("../../shared/ui/card-view");

    scene(
      sceneOfParts((_, h) => [cardLoadingView(h)]),
      given(untouched),
      expectInScene(role("status")).toContainText("読み込み中"),
    );
  });
});

describe("#682 dashboard が使う UI 部品: input・checkbox・select", () => {
  it("AC-004 名前の input の部品は、label で見つかる input を今の React と同じ class・placeholder・必須の印で描き、入力した値が update に届く", async () => {
    const { inputView } = await import("../../shared/ui/input-view");
    const teamName = label("チーム名");

    scene(
      sceneOfParts((current, h) => [
        inputView(
          {
            id: "team-name",
            label: "チーム名",
            value: current.name,
            onInput: (value) => PartMessage.TypedName({ value }),
          },
          h,
        ),
      ]),
      given(untouched),
      expectAll(all.selector("input")).toHaveCount(1),
      expectInScene(teamName).toHaveAttr(
        "class",
        NAME_FIELD_CLASS_OF_REACT_DASHBOARD,
      ),
      expectInScene(teamName).toHaveAttr("placeholder", "チーム名"),
      expectInScene(teamName).toHaveAttr("required"),
      expectInScene(teamName).toHaveValue(""),
      typeInto(teamName, "開発チーム"),
      expectInScene(text("名前の値「開発チーム」")).toExist(),
      expectInScene(teamName).toHaveValue("開発チーム"),
    );
  });

  it("AC-005 checkbox の部品は、label で見つかる checkbox を今の React と同じ class で描き、状態を checked に映し、押すと反対の状態が update に届く", async () => {
    const { checkboxView } = await import("../../shared/ui/input-view");
    const wantsToLearn = label("設計 を学びたい");

    scene(
      sceneOfParts((current, h) => [
        checkboxView(
          {
            id: "wants-to-learn-design",
            label: "学びたい",
            accessibleName: "設計 を学びたい",
            isChecked: current.wantsToLearn,
            onToggle: (isChecked) =>
              PartMessage.ToggledWantsToLearn({ isChecked }),
          },
          h,
        ),
      ]),
      given(untouched),
      expectInScene(wantsToLearn).toHaveAttr("type", "checkbox"),
      expectInScene(wantsToLearn).toHaveAttr(
        "class",
        CHECKBOX_CLASS_OF_REACT_DASHBOARD,
      ),
      expectInScene(selector("label")).toContainText("学びたい"),
      expectInScene(wantsToLearn).not.toBeChecked(),
      click(wantsToLearn),
      expectInScene(text("学びたい「はい」")).toExist(),
      expectInScene(wantsToLearn).toBeChecked(),
      click(wantsToLearn),
      expectInScene(text("学びたい「いいえ」")).toExist(),
      expectInScene(wantsToLearn).not.toBeChecked(),
    );
  });

  it("AC-006 select の部品は、label で見つかる select を今の React の 2 つの select と同じ class で描き、選択肢を並べ、選んだ値が update に届く", async () => {
    const { selectView } = await import("../../shared/ui/select-view");
    const member = label("割り当てるメンバー");
    const level = label("設計 のレベル");
    const options = [
      { value: "1", label: "山田" },
      { value: "2", label: "佐藤" },
    ];

    scene(
      sceneOfParts((current, h) => [
        selectView(
          {
            id: "member-to-assign",
            label: "割り当てるメンバー",
            value: current.selected,
            options,
            onChange: (value) => PartMessage.SelectedOption({ value }),
            look: "field",
          },
          h,
        ),
        selectView(
          {
            id: "level-of-design",
            label: "設計 のレベル",
            value: current.selected,
            options,
            onChange: (value) => PartMessage.SelectedOption({ value }),
            look: "levelSymbol",
          },
          h,
        ),
      ]),
      given(untouched),
      expectAll(all.selector("select")).toHaveCount(2),
      expectInScene(member).toHaveAttr(
        "class",
        NAME_FIELD_CLASS_OF_REACT_DASHBOARD,
      ),
      expectInScene(level).toHaveAttr(
        "class",
        LEVEL_SELECT_CLASS_OF_REACT_DASHBOARD,
      ),
      expectAll(all.selector("#member-to-assign option")).toHaveCount(2),
      expectInScene(selector('#member-to-assign option[value="1"]')).toHaveText(
        "山田",
      ),
      expectInScene(selector('#member-to-assign option[value="2"]')).toHaveText(
        "佐藤",
      ),
      expectInScene(member).toHaveValue("1"),
      change(member, "2"),
      expectInScene(text("選んだ値「2」")).toExist(),
      expectInScene(member).toHaveValue("2"),
    );
  });
});

describe("#682 dashboard が使う UI 部品: 失敗の表示", () => {
  it("AC-007 失敗の表示の部品は、失敗した更新の文言を alert の役割と今の React と同じ class で描く", async () => {
    const { rejectionAlertView } = await import(
      "../../shared/ui/alert-text-view"
    );
    const { Submission } = await import("../../shared/submission");

    scene(
      sceneOfParts((_, h) => [
        ...rejectionAlertView(
          Submission.Rejected({ message: "同じ名前がすでにあります" }),
          h,
        ),
      ]),
      given(untouched),
      expectInScene(role("alert")).toHaveText("同じ名前がすでにあります"),
      expectInScene(role("alert")).toHaveAttr(
        "class",
        FAILURE_ALERT_CLASS_OF_REACT_DASHBOARD,
      ),
    );
  });

  it("AC-008 失敗の表示の部品は、未送信と送信中の更新には alert を描かない", async () => {
    const { rejectionAlertView } = await import(
      "../../shared/ui/alert-text-view"
    );
    const { Submission } = await import("../../shared/submission");

    scene(
      sceneOfParts((_, h) => [
        ...rejectionAlertView(Submission.Idle(), h),
        ...rejectionAlertView(Submission.Submitting(), h),
      ]),
      given(untouched),
      expectInScene(text("名前の値「」")).toExist(),
      expectAll(all.role("alert")).toHaveCount(0),
    );
  });
});

describe("#682 dashboard が使う UI 部品: button", () => {
  it("AC-009 button の部品は、送信の button を type=submit で、今の React の class に aria-disabled の class を足して描く", async () => {
    const { buttonView } = await import("../../shared/ui/button-view");
    const { Submission } = await import("../../shared/submission");
    const createButton = role("button", { name: "チームを作る" });

    scene(
      sceneOfParts((_, h) => [
        buttonView(
          {
            look: "primarySmall",
            type: "submit",
            label: "チームを作る",
            submission: Submission.Idle(),
            isBlocked: false,
          },
          h,
        ),
      ]),
      given(untouched),
      expectInScene(createButton).toHaveAttr("type", "submit"),
      expectInScene(createButton).toHaveAttr(
        "class",
        `${SUBMIT_BUTTON_CLASS_OF_REACT_DASHBOARD} ${ARIA_DISABLED_CLASS}`,
      ),
      expectInScene(createButton).toBeEnabled(),
    );
  });

  it("AC-010 button の部品は、送信中の button と止められた button に aria-disabled を付け、click の handler を持たせない", async () => {
    const { buttonView } = await import("../../shared/ui/button-view");
    const { Submission } = await import("../../shared/submission");
    const saving = role("button", { name: "保存" });
    const blocked = role("button", { name: "割り当てる" });
    const removing = role("button", { name: "外す" });
    const ready = role("button", { name: "削除" });

    scene(
      sceneOfParts((_, h) => [
        buttonView(
          {
            look: "primarySmall",
            type: "submit",
            label: "保存",
            submission: Submission.Submitting(),
            isBlocked: false,
          },
          h,
        ),
        buttonView(
          {
            look: "primarySmall",
            type: "submit",
            label: "割り当てる",
            submission: Submission.Idle(),
            isBlocked: true,
          },
          h,
        ),
        buttonView(
          {
            look: "destructiveOutlineSmall",
            type: "button",
            label: "外す",
            submission: Submission.Submitting(),
            isBlocked: false,
            onClick: PartMessage.ClickedRemove(),
          },
          h,
        ),
        buttonView(
          {
            look: "destructiveOutlineSmall",
            type: "button",
            label: "削除",
            submission: Submission.Rejected({
              message: "削除できませんでした",
            }),
            isBlocked: false,
            onClick: PartMessage.ClickedRemove(),
          },
          h,
        ),
      ]),
      given(untouched),
      expectInScene(saving).toHaveAttr("aria-disabled", "true"),
      expectInScene(blocked).toHaveAttr("aria-disabled", "true"),
      expectInScene(removing).toHaveAttr("aria-disabled", "true"),
      expectInScene(removing).not.toHaveHandler("click"),
      expectInScene(ready).toBeEnabled(),
      expectInScene(ready).toHaveHandler("click"),
    );
  });

  it("AC-011 button の部品は、取り消せない操作の button を渡された名前で見つかる type=button として描き、押すと渡した Message が update に届く", async () => {
    const { buttonView } = await import("../../shared/ui/button-view");
    const { Submission } = await import("../../shared/submission");
    const removeSkill = role("button", { name: "実装 を削除" });

    scene(
      sceneOfParts((_, h) => [
        buttonView(
          {
            look: "destructiveOutlineSmall",
            type: "button",
            label: "削除",
            accessibleName: "実装 を削除",
            submission: Submission.Idle(),
            isBlocked: false,
            onClick: PartMessage.ClickedRemove(),
          },
          h,
        ),
      ]),
      given(untouched),
      expectInScene(removeSkill).toHaveText("削除"),
      expectInScene(removeSkill).toHaveAttr("type", "button"),
      expectInScene(removeSkill).toHaveAttr(
        "class",
        `${REMOVE_BUTTON_CLASS_OF_REACT_DASHBOARD} ${ARIA_DISABLED_CLASS}`,
      ),
      expectInScene(text("削除を押した回数 0")).toExist(),
      click(removeSkill),
      expectInScene(text("削除を押した回数 1")).toExist(),
    );
  });

  it("AC-012 button の部品は、新しいタブで開く link を今の React のメンバーを招待と同じ class・target・rel・読み上げの文言で描く", async () => {
    const { newTabButtonLinkView } = await import(
      "../../shared/ui/button-view"
    );
    const invite = selector('a[href="/auth/account/members"]');

    scene(
      sceneOfParts((_, h) => [
        newTabButtonLinkView(
          { label: "メンバーを招待", href: "/auth/account/members" },
          h,
        ),
      ]),
      given(untouched),
      expectInScene(invite).toHaveAttr(
        "class",
        INVITE_LINK_CLASS_OF_REACT_DASHBOARD,
      ),
      expectInScene(invite).toHaveAttr("target", "_blank"),
      expectInScene(invite).toHaveAttr("rel", "noopener noreferrer"),
      expectInScene(invite).toContainText("メンバーを招待"),
      expectInScene(
        selector('a[href="/auth/account/members"] span'),
      ).toHaveText("(新しいタブで開きます)"),
      expectInScene(
        selector('a[href="/auth/account/members"] span'),
      ).toHaveAttr("class", "sr-only"),
    );
  });

  it("AC-013 新しいタブで開く link の icon は、lucide の ExternalLink の子と同じ数の図形を描く", async () => {
    const { newTabButtonLinkView } = await import(
      "../../shared/ui/button-view"
    );
    const { ExternalLink } = await import("lucide");

    scene(
      sceneOfParts((_, h) => [
        newTabButtonLinkView(
          { label: "メンバーを招待", href: "/auth/account/members" },
          h,
        ),
      ]),
      given(untouched),
      expectInScene(selector("a svg")).toHaveAttr("aria-hidden", "true"),
      expectAll(all.selector("a svg path")).toHaveCount(ExternalLink.length),
    );
    expect(ExternalLink.length).toBeGreaterThan(0);
  });

  it("AC-014 LP の 3 つの button と link の class は、今と同じ文字列のままである", async () => {
    const { buttonView, buttonLinkView } = await import(
      "../../shared/ui/button-view"
    );
    const { Menu, ArrowRight } = await import("lucide");

    scene(
      sceneOfParts((_, h) => [
        buttonView(
          {
            label: "メニュー",
            look: "ghostIconBelowMd",
            icon: Menu,
            onClick: PartMessage.ClickedRemove(),
          },
          h,
        ),
        buttonLinkView(
          {
            label: "Taimei を試す",
            href: "/auth",
            look: "primaryHero",
            trailingIcon: ArrowRight,
          },
          h,
        ),
        buttonLinkView(
          { label: "詳細を見る", href: "/service/1", look: "linkInCard" },
          h,
        ),
      ]),
      given(untouched),
      expectInScene(role("button", { name: "メニュー" })).toHaveAttr(
        "class",
        MENU_BUTTON_CLASS_OF_LANDING,
      ),
      expectInScene(role("link", { name: "Taimei を試す" })).toHaveAttr(
        "class",
        TRY_LINK_CLASS_OF_LANDING,
      ),
      expectInScene(role("link", { name: "詳細を見る" })).toHaveAttr(
        "class",
        DETAIL_LINK_CLASS_OF_LANDING,
      ),
    );
  });
});

describe("#682 form の要素を直に書く場所", () => {
  it("AC-015 page と application の code、shared の直下の code に、form の要素を直に書いた行が無い", () => {
    expect(
      gitGrepLines(
        "h\\.(button|input|select|textarea)\\(",
        "web/src/app/public",
        "web/src/app/dashboard",
        ":(glob)web/src/app/*.ts",
        "web/src/landing/pages",
        "web/src/privacy/pages",
        "web/src/dashboard/pages",
        ":(glob)web/src/dashboard/*.ts",
        ":(glob)web/src/shared/*.ts",
      ),
    ).toEqual([]);
  });
});
