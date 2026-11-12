import { Context, Layer, Schema } from "effect";
// oxlint-disable-next-line no-restricted-imports -- Foldkit の画面が使う SPA の契約の client の fetch を差し替えるのはこの file だけ
import { FetchHttpClient } from "effect/http";
import { HttpApiClient } from "effect/http-api";
import { Http } from "foldkit";
import {
  SESSION_HEADER,
  SessionChanged,
  SpaApi,
} from "../../../src/spa-contract";
import { type Fetch, takingEarlyFetches } from "./early-fetch";

type SpaClient = HttpApiClient.ForApi<typeof SpaApi>;

const SESSION_CHANGED_STATUS = 409;

const sessionChangedResponse = () =>
  Response.json(Schema.encodeSync(SessionChanged)(new SessionChanged()), {
    status: SESSION_CHANGED_STATUS,
  });

const withinFirstSessionOfDocument = (fetch: Fetch): Fetch => {
  let firstMark: string | undefined;
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    if (firstMark !== undefined) {
      headers.set(SESSION_HEADER, firstMark);
    }
    const response = await fetch(input, { ...init, headers });
    const mark = response.headers.get(SESSION_HEADER);
    if (mark === null) {
      return response;
    }
    firstMark ??= mark;
    return mark === firstMark ? response : sessionChangedResponse();
  };
};

export class SpaHttpClient extends Context.Service<SpaHttpClient, SpaClient>()(
  "taimei/web/src/shared/SpaHttpClient",
) {
  static readonly layer = (baseUrl: string) =>
    Layer.effect(SpaHttpClient, HttpApiClient.make(SpaApi, { baseUrl })).pipe(
      Layer.provide(Http.layer),
      Layer.provide(
        Layer.sync(FetchHttpClient.Fetch, () =>
          withinFirstSessionOfDocument(
            takingEarlyFetches((input, init) => globalThis.fetch(input, init)),
          ),
        ),
      ),
    );
}
