import { Option } from "effect";
import {
  all,
  altText,
  click,
  expect,
  expectAll,
  filter,
  first,
  given,
  nth,
  role,
  scene,
  text,
  withViewInputs,
} from "foldkit/scene";
import { describe, it } from "vitest";
import { type Model, update, view } from "../pages/Landing";

const page = {
  update,
  view: withViewInputs(view, {
    landingHref: "/landing-from-application",
    privacyHref: "/privacy-from-application",
  })(),
};

const shownIn2026: Model = {
  isMenuOpen: false,
  maybeCurrentYear: Option.some(2026),
};

const signInLinks = all.role("link", { name: "ログイン" });
const menuButton = role("button", { name: "メニュー" });

describe("LP の link と footer", () => {
  it("ロゴとプライバシーポリシーの link は、application が渡した行き先を指す", () => {
    scene(
      page,
      given(shownIn2026),
      expect(
        first(filter(all.role("link"), { has: altText("myservicelogo") })),
      ).toHaveAttr("href", "/landing-from-application"),
      expect(role("link", { name: "プライバシーポリシー" })).toHaveAttr(
        "href",
        "/privacy-from-application",
      ),
    );
  });

  it("年を読み終えるまでは、年の無い著作権の表示を描く", () => {
    scene(
      page,
      given({ isMenuOpen: false, maybeCurrentYear: Option.none() }),
      expect(text("© Taimei All rights reserved.")).toExist(),
    );
  });
});

describe("LP のメニュー", () => {
  it("メニューの button を押すとログインがもう 1 つ出て、もう一度押すと消える", () => {
    scene(
      page,
      given(shownIn2026),
      click(menuButton),
      expectAll(signInLinks).toHaveCount(2),
      click(menuButton),
      expectAll(signInLinks).toHaveCount(1),
    );
  });

  it("開いたメニューのログインを押すと、メニューが閉じる", () => {
    scene(
      page,
      given(shownIn2026),
      click(menuButton),
      click(nth(signInLinks, 1)),
      expectAll(signInLinks).toHaveCount(1),
    );
  });
});
