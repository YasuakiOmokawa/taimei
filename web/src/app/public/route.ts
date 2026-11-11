import { pipe, Schema } from "effect";
import { Route } from "foldkit";
import { defineRouteUnion, literal } from "foldkit/route";

export const PublicRoute = defineRouteUnion({
  Landing: {},
  Privacy: {},
  NotFound: { path: Schema.String },
});

export const landingRouter = pipe(Route.root, Route.mapTo(PublicRoute.Landing));

export const privacyRouter = pipe(
  literal("privacy"),
  Route.mapTo(PublicRoute.Privacy),
);

export const urlToPublicRoute = Route.parseUrlWithFallback(
  Route.oneOf(landingRouter, privacyRouter),
  PublicRoute.NotFound,
);
