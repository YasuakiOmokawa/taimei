import { Button } from "@foldkit/ui";
import type { Html, HtmlBuilder } from "foldkit/html";
import type { IconNode } from "lucide";
import { buttonVariants, cn } from "./class-names";
import { iconView } from "./icon-view";

type ButtonLook = "ghostIconBelowMd";
type ButtonLinkLook = "primaryHero" | "linkInCard";

const CLASS_BY_LOOK: Record<ButtonLook | ButtonLinkLook, string> = {
  ghostIconBelowMd: cn(
    buttonVariants({ variant: "ghost", size: "icon" }),
    "md:hidden",
  ),
  primaryHero: cn(buttonVariants({ size: "lg" }), "text-base px-8 py-6"),
  linkInCard: cn(buttonVariants({ variant: "link", size: "lg" }), "mt-2"),
};

export const buttonView = <Message>(
  config: Readonly<{
    label: string;
    look: ButtonLook;
    icon: IconNode;
    onClick: Message;
  }>,
  h: HtmlBuilder<Message>,
): Html =>
  Button.view(
    {
      onClick: config.onClick,
      toView: (attributes) =>
        h.button(
          [...attributes.button, h.Class(CLASS_BY_LOOK[config.look])],
          [
            iconView(config.icon, [h.Class("h-5 w-5")], h),
            h.span([h.Class("sr-only")], [config.label]),
          ],
        ),
    },
    h,
  );

export const buttonLinkView = <Message>(
  config: Readonly<{
    label: string;
    href: string;
    look: ButtonLinkLook;
    trailingIcon?: IconNode;
  }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.a(
    [h.Href(config.href), h.Class(CLASS_BY_LOOK[config.look])],
    [
      config.label,
      ...(config.trailingIcon === undefined
        ? []
        : [iconView(config.trailingIcon, [h.Class("ml-2 h-5 w-5")], h)]),
    ],
  );
