declare global {
  var taimeiEarlyFetches: Map<string, Promise<Response>> | undefined;
}

export type Fetch = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const pathAndQueryOf = (input: RequestInfo | URL) => {
  const url = new URL(input instanceof Request ? input.url : input);
  return url.pathname + url.search;
};

const takeEarlyFetch = (input: RequestInfo | URL, init?: RequestInit) => {
  const earlyFetches = globalThis.taimeiEarlyFetches;
  if (earlyFetches === undefined || (init?.method ?? "GET") !== "GET") {
    return undefined;
  }
  const pathAndQuery = pathAndQueryOf(input);
  const early = earlyFetches.get(pathAndQuery);
  earlyFetches.delete(pathAndQuery);
  return early;
};

export const takingEarlyFetches =
  (fetch: Fetch): Fetch =>
  (input, init) =>
    takeEarlyFetch(input, init) ?? fetch(input, init);
