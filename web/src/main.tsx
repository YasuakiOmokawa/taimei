import "@fontsource-variable/inter";
import "@fontsource/lusitana/400.css";
import "./index.css";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { createAppRouter } from "./router";

const router = createAppRouter();
const container = document.getElementById("root")!;
const app = (
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);

// ponytail: Static Assets は / の prerender (index.html) を SPA の fallback にも返すので、prerender していない path は JS が描くまでランディングページが見える。直すなら index.html の inline script で path が違えば #root を隠す
void router.load().then(() => {
  if (container.dataset.prerenderedPath === location.pathname)
    hydrateRoot(container, app);
  else createRoot(container).render(app);
});
