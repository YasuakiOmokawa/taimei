import { Effect, Schema } from "effect";
import { Command } from "foldkit";
import { defineMessageUnion } from "foldkit/message";
import { pushUrl, replaceUrl, UrlRequest } from "foldkit/navigation";
import { type Url, toString as urlToString } from "foldkit/url";
import {
  leaveSpaToSignIn,
  loadDocument,
  reloadDocument,
} from "../shared/leave-spa";

export const Message = defineMessageUnion({
  CompletedLoadDocument: {},
  CompletedNavigateInternal: {},
  CompletedReplaceUrl: {},
  CompletedLeaveToSignIn: {},
  CompletedReloadDocument: {},
});
export type Message = typeof Message.Type;

export const LoadDocument = Command.define("LoadDocument", {
  args: { href: Schema.String },
  messages: [Message.CompletedLoadDocument],
  execute: ({ href }) =>
    Effect.sync(() => loadDocument(href)).pipe(
      Effect.as(Message.CompletedLoadDocument()),
    ),
});

export const NavigateInternal = Command.define("NavigateInternal", {
  args: { href: Schema.String },
  messages: [Message.CompletedNavigateInternal],
  execute: ({ href }) =>
    (href === window.location.href ? replaceUrl(href) : pushUrl(href)).pipe(
      Effect.andThen(
        Effect.sync(() => window.scrollTo({ top: 0, behavior: "instant" })),
      ),
      Effect.as(Message.CompletedNavigateInternal()),
    ),
});

export const ReplaceUrl = Command.define("ReplaceUrl", {
  args: { href: Schema.String },
  messages: [Message.CompletedReplaceUrl],
  execute: ({ href }) =>
    replaceUrl(href).pipe(Effect.as(Message.CompletedReplaceUrl())),
});

export const LeaveToSignIn = Command.define("LeaveToSignIn", {
  messages: [Message.CompletedLeaveToSignIn],
  execute: Effect.sync(leaveSpaToSignIn).pipe(
    Effect.as(Message.CompletedLeaveToSignIn()),
  ),
});

export const ReloadDocument = Command.define("ReloadDocument", {
  messages: [Message.CompletedReloadDocument],
  execute: Effect.sync(reloadDocument).pipe(
    Effect.as(Message.CompletedReloadDocument()),
  ),
});

export const commandForLink = (
  request: UrlRequest,
  isOwnRoute: (url: Url) => boolean,
): Command.Command<Message> =>
  UrlRequest.match(request, {
    Internal: ({ url }) =>
      isOwnRoute(url)
        ? NavigateInternal({ href: urlToString(url) })
        : LoadDocument({ href: urlToString(url) }),
    External: ({ href }) => LoadDocument({ href }),
  });
