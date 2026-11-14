import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { Effect, Option } from "effect";
import type { Update } from "foldkit";
import { renderToString } from "foldkit/experimental/server";
import { fromString as urlFromString } from "foldkit/url";
import {
  init,
  type Message,
  type Model,
  update,
  view,
} from "./src/app/public/main";

const dist = path.join(import.meta.dirname, "dist");
const PRERENDER_ORIGIN = "http://localhost";
const PRIVACY_FILE_SERVED_WITHOUT_TRAILING_SLASH_REDIRECT = "privacy.html";
const pages = [
  { path: "/", file: "index.html" },
  {
    path: "/privacy",
    file: PRIVACY_FILE_SERVED_WITHOUT_TRAILING_SLASH_REDIRECT,
  },
];

const template = await readFile(path.join(dist, "index.html"), "utf8");
for (const marker of ['<div id="root"></div>', "<title>"]) {
  if (!template.includes(marker)) {
    throw new Error(
      `dist/index.html に ${marker} が無い (vite build の直後に流す)`,
    );
  }
}

const replacingWithoutDollarPatterns = (replacement: string) => () =>
  replacement;

const modelAfterCommandsSettle = async (
  step: Update.Return<Model, Message>,
): Promise<Model> => {
  let model = step.model;
  for (const command of step.commands ?? []) {
    model = await modelAfterCommandsSettle(
      update(model, await Effect.runPromise(command.effect)),
    );
  }
  return model;
};

for (const page of pages) {
  const url = `${PRERENDER_ORIGIN}${page.path}`;
  const model = await modelAfterCommandsSettle(
    init(Option.getOrThrow(urlFromString(url))),
  );
  const rendered = await Effect.runPromise(
    renderToString(
      { routing: {}, init: () => ({ model }), view },
      { url, isHydratable: false },
    ),
  );
  await writeFile(
    path.join(dist, page.file),
    template
      .replace(
        '<div id="root"></div>',
        replacingWithoutDollarPatterns(
          `<div id="root" data-prerendered-path="${page.path}">${rendered.html}</div>`,
        ),
      )
      .replace(
        /<title>.*<\/title>/,
        replacingWithoutDollarPatterns(`<title>${rendered.title}</title>`),
      ),
  );
}
