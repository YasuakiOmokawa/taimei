import { Effect, Schema } from "effect";
import { Command, type Runtime, type Update } from "foldkit";
import type { Document, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { load, pushUrl, UrlRequest } from "foldkit/navigation";
import { modifyFields } from "foldkit/struct";
import { Url, toString as urlToString } from "foldkit/url";
import * as Privacy from "../../privacy/pages/Privacy";
import { PublicRoute, urlToPublicRoute } from "./route";

export const Model = Schema.Struct({ route: PublicRoute });
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  CompletedPushUrl: {},
  CompletedLoadDocument: {},
});
export type Message = typeof Message.Type;

export const init: Runtime.RoutingApplicationInit<Model, Message> = (url) => ({
  model: { route: urlToPublicRoute(url) },
});

export const PushUrl = Command.define("PushUrl", {
  args: { href: Schema.String },
  messages: [Message.CompletedPushUrl],
  execute: ({ href }) =>
    pushUrl(href).pipe(Effect.as(Message.CompletedPushUrl())),
});

export const LoadDocument = Command.define("LoadDocument", {
  args: { href: Schema.String },
  messages: [Message.CompletedLoadDocument],
  execute: ({ href }) =>
    load(href).pipe(Effect.as(Message.CompletedLoadDocument())),
});

const isOwnRoute = (url: Url) =>
  !PublicRoute.guards.NotFound(urlToPublicRoute(url));

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    ClickedLink: ({ request }) => ({
      model,
      commands: [
        UrlRequest.match(request, {
          Internal: ({ url }) =>
            isOwnRoute(url)
              ? PushUrl({ href: urlToString(url) })
              : LoadDocument({ href: urlToString(url) }),
          External: ({ href }) => LoadDocument({ href }),
        }),
      ],
    }),
    ChangedUrl: ({ url }) => ({
      model: modifyFields(model, { route: () => urlToPublicRoute(url) }),
    }),
    CompletedPushUrl: () => ({ model }),
    CompletedLoadDocument: () => ({ model }),
  });

export const view = (model: Model, h: HtmlBuilder<Message>): Document =>
  PublicRoute.match(model.route, {
    Privacy: () => ({ title: Privacy.title, body: Privacy.view(h) }),
    NotFound: () => ({ title: "Taimei", body: h.p([], ["Not Found"]) }),
  });
