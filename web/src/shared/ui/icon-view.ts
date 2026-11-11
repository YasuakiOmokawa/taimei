import {
  type Attribute,
  type Html,
  type HtmlBuilder,
  inertHtml as ih,
} from "foldkit/html";
import type { IconNode } from "lucide";

const SVG_CHILD_TAGS = [
  "path",
  "circle",
  "line",
  "rect",
  "polyline",
  "polygon",
  "ellipse",
  "g",
] as const;
type SvgChildTag = (typeof SVG_CHILD_TAGS)[number];

const isSvgChildTag = (tag: string): tag is SvgChildTag =>
  SVG_CHILD_TAGS.some((known) => known === tag);

const LUCIDE_SVG_ATTRIBUTES = [
  ih.Xmlns("http://www.w3.org/2000/svg"),
  ih.Width("24"),
  ih.Height("24"),
  ih.ViewBox("0 0 24 24"),
  ih.Fill("none"),
  ih.Stroke("currentColor"),
  ih.StrokeWidth("2"),
  ih.StrokeLinecap("round"),
  ih.StrokeLinejoin("round"),
  ih.AriaHidden(true),
];

export const iconView = <Message>(
  icon: IconNode,
  extraAttributes: ReadonlyArray<Attribute<Message>>,
  h: HtmlBuilder<Message>,
): Html =>
  h.svg(
    [...LUCIDE_SVG_ATTRIBUTES, ...extraAttributes],
    icon.flatMap(([tag, attributes]) =>
      isSvgChildTag(tag)
        ? [
            h[tag](
              Object.entries(attributes).map(([key, value]) =>
                h.Attribute(key, String(value)),
              ),
            ),
          ]
        : [],
    ),
  );
