import type { Html, HtmlBuilder } from "foldkit/html";

const CARD_MESSAGE_CLASS =
  "px-6 py-10 text-center text-sm text-muted-foreground";

export const cardView = <Message>(
  children: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [
      h.Class(
        "rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden",
      ),
    ],
    children,
  );

export const cardMessageView = <Message>(
  text: string,
  h: HtmlBuilder<Message>,
): Html => h.p([h.Class(CARD_MESSAGE_CLASS)], [text]);

export const cardLoadingView = <Message>(h: HtmlBuilder<Message>): Html =>
  h.p(
    [h.Role("status"), h.AriaLive("polite"), h.Class(CARD_MESSAGE_CLASS)],
    ["読み込み中…"],
  );
