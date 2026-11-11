import { Option } from "effect";
import { UrlRequest } from "foldkit/navigation";
import { Command, given, message, model, story } from "foldkit/story";
import { fromString } from "foldkit/url";
import { describe, expect, it } from "vitest";
import {
  init,
  LoadDocument,
  Message,
  type Model,
  PushUrl,
  update,
} from "../public/main";
import { PublicRoute } from "../public/route";

const ORIGIN = "https://app.example.com";

const urlOf = (href: string) =>
  Option.getOrThrowWith(
    fromString(href),
    () => new Error(`URL として読めない: ${href}`),
  );

const opened = (pathname: string): Model =>
  init(urlOf(`${ORIGIN}${pathname}`)).model;

const clickedInternalLink = (pathname: string) =>
  Message.ClickedLink({
    request: UrlRequest.Internal({ url: urlOf(`${ORIGIN}${pathname}`) }),
  });

describe("application public は URL を route に読む", () => {
  it.each([
    ["/privacy", PublicRoute.Privacy()],
    ["/privacy/", PublicRoute.Privacy()],
    ["/no-such-page", PublicRoute.NotFound({ path: "/no-such-page" })],
  ])("%s を開くと、その path の route になる", (pathname, route) => {
    expect(opened(pathname).route).toEqual(route);
  });

  it("URL が変わると、新しい URL の route に替わる", () => {
    story(
      update,
      given(opened("/no-such-page")),
      message(Message.ChangedUrl({ url: urlOf(`${ORIGIN}/privacy`) })),
      model((next) => {
        expect(next.route).toEqual(PublicRoute.Privacy());
      }),
    );
  });
});

describe("application public の link", () => {
  it("自分の route への link は、document を読み直さずに URL を替える", () => {
    story(
      update,
      given(opened("/no-such-page")),
      message(clickedInternalLink("/privacy")),
      Command.expectExact(PushUrl({ href: `${ORIGIN}/privacy` })),
      Command.resolve(PushUrl, Message.CompletedPushUrl()),
    );
  });

  it.each(["/auth", "/dashboard/teams"])(
    "同じ origin でも自分の route でない %s への link は、document を読み直す",
    (pathname) => {
      story(
        update,
        given(opened("/privacy")),
        message(clickedInternalLink(pathname)),
        Command.expectExact(LoadDocument({ href: `${ORIGIN}${pathname}` })),
        Command.resolve(LoadDocument, Message.CompletedLoadDocument()),
      );
    },
  );

  it("外の site への link は、document を読み直す", () => {
    story(
      update,
      given(opened("/privacy")),
      message(
        Message.ClickedLink({
          request: UrlRequest.External({ href: "https://example.com/" }),
        }),
      ),
      Command.expectExact(LoadDocument({ href: "https://example.com/" })),
      Command.resolve(LoadDocument, Message.CompletedLoadDocument()),
    );
  });
});
