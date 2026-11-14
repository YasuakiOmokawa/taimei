import type { Document, HtmlBuilder } from "foldkit/html";
import type { CrashContext } from "foldkit/runtime";
import { SERVICE_NAME } from "./ui/brand-view";

export const CRASH_MESSAGE =
  "画面を表示できませんでした。再読み込みしてください";
export const CRASH_STYLE = { padding: ".5rem", maxWidth: "100%" } as const;

export const crashView = <Model, Message>(
  _context: CrashContext<Model, Message>,
  h: HtmlBuilder<never>,
): Document => ({
  title: SERVICE_NAME,
  body: h.div([h.Role("alert"), h.Style(CRASH_STYLE)], [CRASH_MESSAGE]),
});
