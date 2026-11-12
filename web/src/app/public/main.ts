import { Effect, Option, Schema } from "effect";
import { Command, type Runtime, Update } from "foldkit";
import type { Document, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { pushUrl, UrlRequest } from "foldkit/navigation";
import { modifyFields } from "foldkit/struct";
import { Url, toString as urlToString } from "foldkit/url";
import * as Landing from "../../landing/pages/Landing";
import * as Privacy from "../../privacy/pages/Privacy";
import { loadDocument } from "../../shared/leave-spa";
import { SERVICE_NAME } from "../../shared/ui/brand-view";
import {
  landingRouter,
  PublicRoute,
  privacyRouter,
  urlToPublicRoute,
} from "./route";

export const Model = Schema.Struct({
  route: PublicRoute,
  landing: Landing.Model,
});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
  CompletedPushUrl: {},
  CompletedLoadDocument: {},
  GotLandingMessage: { message: Landing.Message },
});
export type Message = typeof Message.Type;

const LANDING_VIEW_INPUTS = {
  landingHref: landingRouter(),
  privacyHref: privacyRouter(),
};

const toLandingMessage = (message: Landing.Message) =>
  Message.GotLandingMessage({ message });

export const init: Runtime.RoutingApplicationInit<Model, Message> = (url) =>
  Update.foldChildInit(Landing.init(), {
    toParentModel: (landing) => ({ route: urlToPublicRoute(url), landing }),
    toParentMessage: toLandingMessage,
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
    Effect.sync(() => loadDocument(href)).pipe(
      Effect.as(Message.CompletedLoadDocument()),
    ),
});

const isOwnRoute = (url: Url) =>
  !PublicRoute.guards.NotFound(urlToPublicRoute(url));

const landingChild = {
  read: (model: Model) => Option.some(model.landing),
  write: (model: Model, nextLanding: Landing.Model): Model =>
    modifyFields(model, { landing: () => nextLanding }),
  toParentMessage: toLandingMessage,
};

const foldLanding = Update.foldChild({
  ...landingChild,
  update: Landing.update,
});

const foldLandingCloseMenu = Update.foldChildStep({
  ...landingChild,
  update: Landing.closeMenu,
});

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
    ChangedUrl: ({ url }) =>
      foldLandingCloseMenu(
        modifyFields(model, { route: () => urlToPublicRoute(url) }),
      ),
    CompletedPushUrl: () => ({ model }),
    CompletedLoadDocument: () => ({ model }),
    GotLandingMessage: ({ message }) => foldLanding(model, message),
  });

export const view = (model: Model, h: HtmlBuilder<Message>): Document =>
  PublicRoute.match(model.route, {
    Landing: () => ({
      title: SERVICE_NAME,
      body: h.submodel({
        slotId: "landing",
        view: Landing.view,
        model: model.landing,
        viewInputs: LANDING_VIEW_INPUTS,
        toParentMessage: toLandingMessage,
      }),
    }),
    Privacy: () => ({ title: Privacy.title, body: Privacy.view(h) }),
    NotFound: () => ({ title: SERVICE_NAME, body: h.p([], ["Not Found"]) }),
  });
