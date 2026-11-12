import { Option, Schema } from "effect";
import { Command, type Runtime, Update } from "foldkit";
import type { Document, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { UrlRequest } from "foldkit/navigation";
import { modifyFields } from "foldkit/struct";
import { Url } from "foldkit/url";
import * as Landing from "../../landing/pages/Landing";
import * as Privacy from "../../privacy/pages/Privacy";
import { SERVICE_NAME } from "../../shared/ui/brand-view";
import * as DocumentNavigation from "../document-navigation";
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
  GotDocumentNavigationMessage: { message: DocumentNavigation.Message },
  ClickedLink: { request: UrlRequest },
  ChangedUrl: { url: Url },
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

const navigate = (command: Command.Command<DocumentNavigation.Message>) =>
  Command.mapMessage(command, (message) =>
    Message.GotDocumentNavigationMessage({ message }),
  );

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
    GotDocumentNavigationMessage: () => ({ model }),
    ClickedLink: ({ request }) => ({
      model,
      commands: [
        navigate(DocumentNavigation.commandForLink(request, isOwnRoute)),
      ],
    }),
    ChangedUrl: ({ url }) =>
      foldLandingCloseMenu(
        modifyFields(model, { route: () => urlToPublicRoute(url) }),
      ),
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
