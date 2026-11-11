import { pipe, Schema } from "effect";
import { Route } from "foldkit";
import { defineRouteUnion, literal } from "foldkit/route";

export const PublicRoute = defineRouteUnion({
  Privacy: {},
  NotFound: { path: Schema.String },
});

const privacyRouter = pipe(
  literal("privacy"),
  Route.mapTo(PublicRoute.Privacy),
);

export const urlToPublicRoute = Route.parseUrlWithFallback(
  privacyRouter,
  PublicRoute.NotFound,
);
