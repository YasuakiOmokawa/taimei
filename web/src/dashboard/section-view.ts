import type { Html, HtmlBuilder } from "foldkit/html";
import { cardView } from "../shared/ui/card-view";

export const sectionView = <Message>(
  heading: Readonly<{ title: string; description?: string }>,
  children: ReadonlyArray<Html>,
  h: HtmlBuilder<Message>,
): Html =>
  cardView(
    [
      h.div(
        [h.Class("space-y-1 p-6 pb-4")],
        [
          h.h2([h.Class("font-semibold")], [heading.title]),
          ...(heading.description === undefined
            ? []
            : [
                h.p(
                  [h.Class("text-sm text-muted-foreground")],
                  [heading.description],
                ),
              ]),
        ],
      ),
      ...children,
    ],
    h,
  );
