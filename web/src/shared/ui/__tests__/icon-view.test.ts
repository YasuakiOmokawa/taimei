import { inertHtml } from "foldkit/html";
import { icons } from "lucide";
import { expect, test } from "vitest";
import { iconView } from "../icon-view";

test("固定した版の lucide のどの icon も、子の図形を 1 つも落とさずに描く (lucide を上げて落ちたら、icon-view.ts の tag の表に足す)", () => {
  const iconsWithDroppedChildren = Object.entries(icons)
    .filter(
      ([, icon]) =>
        iconView(icon, [], inertHtml)?.children?.length !== icon.length,
    )
    .map(([name]) => name);

  expect(Object.keys(icons).length).toBeGreaterThan(1000);
  expect(iconsWithDroppedChildren).toEqual([]);
});
