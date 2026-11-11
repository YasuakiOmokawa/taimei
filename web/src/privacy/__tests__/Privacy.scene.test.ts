import type { Html, HtmlBuilder } from "foldkit/html";
import {
  all,
  expect,
  expectAll,
  given,
  role,
  scene,
  text,
} from "foldkit/scene";
import { it } from "vitest";
import { view } from "../pages/Privacy";

const page = {
  update: (model: null, _message: never) => ({ model }),
  view: (_model: null, h: HtmlBuilder<never>): Html => view(h),
};

it("taimei のデータベースはシンガポールにあると書く", () => {
  scene(
    page,
    given(null),
    expect(
      text("データベース (taimei): Neon (AWS アジア太平洋・シンガポール)"),
    ).toExist(),
  );
});

it("ページを最後の節まで描く", () => {
  scene(
    page,
    given(null),
    expect(role("heading", { level: 1 })).toExist(),
    expect(role("heading", { level: 2, name: "問い合わせ先" })).toExist(),
  );
});

it("もう使っていない Vercel を書かない", () => {
  scene(page, given(null), expect(role("main")).not.toContainText("Vercel"));
});

it("アプリは Cloudflare で動くと書く", () => {
  scene(page, given(null), expect(text("アプリ: Cloudflare")).toExist());
});

it("Sentry にはエラーだけを送り、入力した内容は送らないと書く", () => {
  scene(
    page,
    given(null),
    expect(
      text("エラーの記録: Sentry (米国)。入力した内容は送らない"),
    ).toExist(),
    expectAll(all.role("listitem")).toHaveCount(6),
  );
});

it("消した後も復元用の履歴に残る期間は、Neon の Free の上限の 6 時間と書く", () => {
  scene(
    page,
    given(null),
    expect(role("main")).toContainText("消した後も 6 時間残ります"),
  );
});

it("もうしていない画面の操作の記録と性能の計測を書かない", () => {
  scene(
    page,
    given(null),
    expect(role("main")).not.toContainText("画面の操作の記録"),
    expect(role("main")).not.toContainText("性能の計測"),
  );
});
