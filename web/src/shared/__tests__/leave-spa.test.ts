import { afterEach, expect, it, vi } from "vitest";
import { loadDocument, reloadDocument } from "../leave-spa";

afterEach(() => {
  vi.unstubAllGlobals();
});

const stubLocation = () => {
  const location = { assign: vi.fn(), reload: vi.fn() };
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
