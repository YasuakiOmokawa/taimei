import { Button } from "@foldkit/ui";
import type { Html, HtmlBuilder } from "foldkit/html";
import { ExternalLink, type IconNode } from "lucide";
import { Submission } from "../submission";
import { buttonVariants, cn } from "./class-names";
import { iconView } from "./icon-view";

type IconButtonLook = "ghostIconBelowMd";
type SubmittingButtonLook = "primarySmall" | "destructiveOutlineSmall";
type ButtonLinkLook = "primaryHero" | "linkInCard";

const CLASS_BY_LOOK: Record<IconButtonLook | ButtonLinkLook, string> = {
  ghostIconBelowMd: cn(
    buttonVariants({ variant: "ghost", size: "icon" }),
    "md:hidden",
  ),
  primaryHero: cn(buttonVariants({ size: "lg" }), "text-base px-8 py-6"),
  linkInCard: cn(buttonVariants({ variant: "link", size: "lg" }), "mt-2"),
};

const CLASS_BEFORE_DISABLED_BY_SUBMITTING_LOOK: Record<
  SubmittingButtonLook,
  ReadonlyArray<string>
> = {
  primarySmall: [buttonVariants({ size: "sm" })],
  destructiveOutlineSmall: [
    buttonVariants({ variant: "outline", size: "sm" }),
    "shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive",
  ],
};

const classOfSubmittingLook = (look: SubmittingButtonLook) =>
  cn(
    CLASS_BEFORE_DISABLED_BY_SUBMITTING_LOOK[look],
    "aria-disabled:pointer-events-none aria-disabled:opacity-50",
  );

const NEW_TAB_LINK_CLASS = cn(
  buttonVariants({ variant: "outline", size: "sm" }),
);

type IconButtonConfig<Message> = Readonly<{
  look: IconButtonLook;
  label: string;
  icon: IconNode;
  onClick: Message;
}>;

type SubmittingButtonConfig<Message> = Readonly<{
  look: SubmittingButtonLook;
  label: string;
  accessibleName?: string;
  submission: Submission;
  isBlocked: boolean;
}> &
  (
    | Readonly<{ type: "submit" }>
    | Readonly<{ type: "button"; onClick: Message }>
  );

const iconButtonView = <Message>(
  config: IconButtonConfig<Message>,
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

const submittingButtonView = <Message>(
  config: SubmittingButtonConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  Button.view(
    {
      type: config.type,
      onClick: config.type === "button" ? config.onClick : undefined,
      isDisabled:
        config.isBlocked || Submission.guards.Submitting(config.submission),
      toView: (attributes) =>
        h.button(
          [
            ...attributes.button,
            h.Class(classOfSubmittingLook(config.look)),
            ...(config.accessibleName === undefined
              ? []
              : [h.AriaLabel(config.accessibleName)]),
          ],
          [config.label],
        ),
    },
    h,
  );

export const buttonView = <Message>(
  config: IconButtonConfig<Message> | SubmittingButtonConfig<Message>,
  h: HtmlBuilder<Message>,
): Html =>
  config.look === "ghostIconBelowMd"
    ? iconButtonView(config, h)
    : submittingButtonView(config, h);

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

export const newTabButtonLinkView = <Message>(
  config: Readonly<{ label: string; href: string }>,
  h: HtmlBuilder<Message>,
): Html =>
  h.a(
    [
      h.Href(config.href),
      h.Target("_blank"),
      h.Rel("noopener noreferrer"),
      h.Class(NEW_TAB_LINK_CLASS),
    ],
    [
      config.label,
      iconView(ExternalLink, [], h),
      h.span([h.Class("sr-only")], ["(新しいタブで開きます)"]),
    ],
  );
