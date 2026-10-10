import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { renderToString } from "react-dom/server";
import { createAppRouter } from "./src/router";

const dist = path.join(import.meta.dirname, "dist");
// Static Assets は /privacy に privacy.html を返す。privacy/index.html だと /privacy/ へ redirect する
const pages = [
  { path: "/", file: "index.html", title: undefined },
  { path: "/privacy", file: "privacy.html", title: "プライバシーポリシー" },
];

const template = await readFile(path.join(dist, "index.html"), "utf8");
for (const marker of ["</head>", '<div id="root"></div>', "<title>"])
  if (!template.includes(marker))
    throw new Error(
      `dist/index.html に ${marker} が無い (vite build の直後に流す)`,
    );

for (const page of pages) {
  // TanStack Router は server の描画で Outlet の Suspense を省き、client の hydrate と食い違う。package.json の build が browser の条件で client の描画を使わせ、それに要る origin をここで渡す
  const router = createAppRouter({
    history: createMemoryHistory({ initialEntries: [page.path] }),
    origin: "http://localhost",
  });
  await router.load();
  // React 19 は <img> の preload を出力の先頭に置く。#root に残すと hydrate で食い違うので head に移す
  const [, preloads, html] = renderToString(
    <RouterProvider router={router} />,
  ).match(/^((?:<link [^>]*\/>)*)([\s\S]*)$/)!;
  // 置き換え後を関数で渡す。文字列だと本文の `$&`・`$'` を replace が記号として読む
  const document = template
    .replace("</head>", () => `${preloads}</head>`)
    .replace(
      '<div id="root"></div>',
      () => `<div id="root" data-prerendered-path="${page.path}">${html}</div>`,
    )
    .replace(/<title>.*<\/title>/, (title) =>
      page.title ? `<title>${page.title}</title>` : title,
    );
  await writeFile(path.join(dist, page.file), document);
}
