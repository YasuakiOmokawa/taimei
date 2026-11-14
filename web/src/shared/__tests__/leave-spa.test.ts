import { afterEach, expect, it, vi } from "vitest";
import {
  leaveSpaToSignIn,
  loadDocument,
  reloadDocument,
  reloadIfRestoredWhileLeaving,
} from "../leave-spa";

afterEach(() => {
  vi.unstubAllGlobals();
});

const stubLocation = () => {
  const location = {
    pathname: "/dashboard/teams",
    search: "",
    assign: vi.fn(),
    reload: vi.fn(),
  };
  vi.stubGlobal("window", { location });
  return location;
};

it("読み直す口は、document を 1 回読み直す", () => {
  const location = stubLocation();

  reloadDocument();

  expect(location.reload).toHaveBeenCalledExactlyOnceWith();
});

it("document を読む口は、履歴に積んで渡した行き先へ document ごと移る", () => {
  const location = stubLocation();

  loadDocument("http://app.example/service/1");

  expect(location.assign).toHaveBeenCalledExactlyOnceWith(
    "http://app.example/service/1",
  );
});

it("ログインへ移った後の読み直しは、document を読み直さない", () => {
  const location = stubLocation();

  leaveSpaToSignIn();
  reloadDocument();

  expect(location.assign).toHaveBeenCalledOnce();
  expect(location.reload).not.toHaveBeenCalled();
});

it("読み直した後のログインへの移動と 2 回目の読み直しは、何もしない", () => {
  const location = stubLocation();

  reloadDocument();
  leaveSpaToSignIn();
  reloadDocument();

  expect(location.reload).toHaveBeenCalledExactlyOnceWith();
  expect(location.assign).not.toHaveBeenCalled();
});

it("離れる途中で bfcache から戻った document は 1 回読み直し、その後の 401 でもう一度ログインへ移れる", () => {
  const location = stubLocation();

  leaveSpaToSignIn();
  reloadIfRestoredWhileLeaving();
  leaveSpaToSignIn();

  expect(location.reload).toHaveBeenCalledExactlyOnceWith();
  expect(location.assign).toHaveBeenCalledTimes(2);
});

it("離れていない document が bfcache から戻っても、読み直さない", () => {
  const location = stubLocation();

  reloadIfRestoredWhileLeaving();

  expect(location.reload).not.toHaveBeenCalled();
});
