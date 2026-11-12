import { Array, Boolean, Effect, Option, Schema } from "effect";
import { Calendar, Command, Submodel, type Update } from "foldkit";
import type { Html, HtmlBuilder } from "foldkit/html";
import { defineMessageUnion } from "foldkit/message";
import { modifyFields } from "foldkit/struct";
import { ArrowRight, Menu, X } from "lucide";
import { SIGN_IN_PATH } from "../../shared/sign-in-path";
import { SERVICE_NAME, serviceLogoView } from "../../shared/ui/brand-view";
import { buttonLinkView, buttonView } from "../../shared/ui/button-view";

const SERVICES: ReadonlyArray<{ title: string; description: string }> = [
  { title: "癒し", description: "忙しい現代人にやすらぎを。" },
  { title: "収入アップ", description: "フリーランスで年収1000万円。" },
  { title: "斧投げ", description: "物理的にマサカリを投げよう。" },
];

export const Model = Schema.Struct({
  isMenuOpen: Schema.Boolean,
  maybeCurrentYear: Schema.Option(Schema.Int),
});
export type Model = typeof Model.Type;

export const Message = defineMessageUnion({
  ClickedMenuButton: {},
  ClickedMenuSignInLink: {},
  CompletedReadCurrentYear: { year: Schema.Int },
});
export type Message = typeof Message.Type;

type ViewInputs = Readonly<{ landingHref: string; privacyHref: string }>;

const ReadCurrentYear = Command.define("ReadCurrentYear", {
  messages: [Message.CompletedReadCurrentYear],
  execute: Effect.map(Calendar.today.local, (today) =>
    Message.CompletedReadCurrentYear({ year: today.year }),
  ),
});

export const init = (): Update.Return<Model, Message> => ({
  model: { isMenuOpen: false, maybeCurrentYear: Option.none() },
  commands: [ReadCurrentYear()],
});

export const closeMenu = (model: Model): Update.Return<Model, Message> => ({
  model: modifyFields(model, { isMenuOpen: () => false }),
});

export const update = (model: Model, message: Message) =>
  Message.match<Update.Return<Model, Message>>(message, {
    ClickedMenuButton: () => ({
      model: modifyFields(model, { isMenuOpen: Boolean.not }),
    }),
    ClickedMenuSignInLink: () => closeMenu(model),
    CompletedReadCurrentYear: ({ year }) => ({
      model: modifyFields(model, {
        maybeCurrentYear: () => Option.some(year),
      }),
    }),
  });

const menuView = (h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("md:hidden border-t")],
    [
      h.nav(
        [h.Class("container flex flex-col py-4")],
        [
          h.a(
            [
              h.Href(SIGN_IN_PATH),
              h.Class(
                "py-2 text-sm font-medium transition-colors hover:text-primary",
              ),
              h.OnClick(Message.ClickedMenuSignInLink()),
            ],
            ["ログイン"],
          ),
        ],
      ),
    ],
  );

const headerView = (
  model: Model,
  viewInputs: ViewInputs,
  h: HtmlBuilder<Message>,
): Html =>
  h.header(
    [
      h.Class(
        "sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      ),
    ],
    [
      h.div(
        [
          h.Class(
            "container flex h-16 lg:h-20 items-center justify-between max-w-7xl mx-auto",
          ),
        ],
        [
          h.a(
            [
              h.Href(viewInputs.landingHref),
              h.Class("flex items-center gap-2 font-bold text-xl lg:text-2xl"),
            ],
            [serviceLogoView(h)],
          ),
          h.nav(
            [h.Class("hidden md:flex gap-8")],
            [
              h.a(
                [
                  h.Href(SIGN_IN_PATH),
                  h.Class(
                    "text-base font-medium transition-colors hover:text-primary",
                  ),
                ],
                ["ログイン"],
              ),
            ],
          ),
          buttonView(
            {
              label: "メニュー",
              look: "ghostIconBelowMd",
              icon: model.isMenuOpen ? X : Menu,
              onClick: Message.ClickedMenuButton(),
            },
            h,
          ),
        ],
      ),
      model.isMenuOpen ? menuView(h) : h.empty,
    ],
  );

const heroCopyView = (h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("flex flex-col justify-center space-y-4 lg:space-y-6")],
    [
      h.div(
        [h.Class("space-y-2 lg:space-y-4")],
        [
          h.h1(
            [
              h.Class(
                "text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl",
              ),
            ],
            ["心安らかな", h.br([]), "ソリューション"],
          ),
          h.p(
            [
              h.Class(
                "max-w-[600px] text-muted-foreground md:text-xl lg:text-2xl",
              ),
            ],
            [`それが ${SERVICE_NAME}`],
          ),
        ],
      ),
      h.div(
        [h.Class("flex flex-col gap-2 min-[400px]:flex-row")],
        [
          buttonLinkView(
            {
              label: `${SERVICE_NAME} を試す`,
              href: SIGN_IN_PATH,
              look: "primaryHero",
              trailingIcon: ArrowRight,
            },
            h,
          ),
        ],
      ),
    ],
  );

const heroImageView = (h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class("flex justify-center lg:justify-end")],
    [
      h.img([
        h.Src("/icons/hero-image.webp"),
        h.Width("600"),
        h.Height("600"),
        h.Alt("ヒーローイメージ"),
        h.Class(
          "mx-auto aspect-square overflow-hidden rounded-xl object-cover lg:w-full lg:max-w-[600px]",
        ),
      ]),
    ],
  );

const heroView = (h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.Class("w-full py-12 md:py-24 lg:py-32")],
    [
      h.div(
        [h.Class("container px-4 md:px-6 max-w-7xl mx-auto")],
        [
          h.div(
            [
              h.Class(
                "grid gap-6 lg:grid-cols-2 lg:gap-16 xl:gap-24 items-center",
              ),
            ],
            [heroCopyView(h), heroImageView(h)],
          ),
        ],
      ),
    ],
  );

const serviceCardView = (
  service: (typeof SERVICES)[number],
  position: number,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [
      h.Class(
        "flex flex-col items-center space-y-4 rounded-lg border p-6 lg:p-8 shadow-sm bg-background hover:shadow-md transition-shadow",
      ),
    ],
    [
      h.div(
        [
          h.Class(
            "h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center",
          ),
        ],
        [
          h.span(
            [h.Class("text-2xl font-bold text-primary")],
            [String(position)],
          ),
        ],
      ),
      h.h3([h.Class("text-xl lg:text-2xl font-bold")], [service.title]),
      h.p(
        [h.Class("text-muted-foreground text-center text-base lg:text-lg")],
        [service.description],
      ),
      buttonLinkView(
        {
          label: "詳細を見る",
          href: `/service/${position}`,
          look: "linkInCard",
        },
        h,
      ),
    ],
  );

const servicesHeadingView = (h: HtmlBuilder<Message>): Html =>
  h.div(
    [
      h.Class(
        "flex flex-col items-center justify-center space-y-4 text-center mb-10 lg:mb-16",
      ),
    ],
    [
      h.div(
        [h.Class("space-y-2 lg:space-y-4")],
        [
          h.h2(
            [
              h.Class(
                "text-3xl font-bold tracking-tighter md:text-4xl lg:text-5xl",
              ),
            ],
            [`${SERVICE_NAME} でできること`],
          ),
          h.p(
            [
              h.Class(
                "max-w-[700px] text-muted-foreground md:text-xl lg:text-2xl",
              ),
            ],
            ["全人類待望のサービスです"],
          ),
        ],
      ),
    ],
  );

const servicesView = (h: HtmlBuilder<Message>): Html =>
  h.section(
    [h.Id("service"), h.Class("w-full py-12 md:py-24 lg:py-32 bg-muted/50")],
    [
      h.div(
        [h.Class("container px-4 md:px-6 max-w-7xl mx-auto")],
        [
          servicesHeadingView(h),
          h.div(
            [
              h.Class(
                "mx-auto grid max-w-6xl gap-8 py-8 md:grid-cols-3 lg:gap-12",
              ),
            ],
            Array.map(SERVICES, (service, index) =>
              serviceCardView(service, index + 1, h),
            ),
          ),
        ],
      ),
    ],
  );

const copyrightText = (maybeCurrentYear: Option.Option<number>): string =>
  Option.match(maybeCurrentYear, {
    onNone: () => `© ${SERVICE_NAME} All rights reserved.`,
    onSome: (year) => `© ${year} ${SERVICE_NAME} All rights reserved.`,
  });

const footerView = (
  model: Model,
  viewInputs: ViewInputs,
  h: HtmlBuilder<Message>,
): Html =>
  h.footer(
    [h.Class("w-full border-t bg-background py-8 lg:py-12")],
    [
      h.div(
        [h.Class("container px-4 md:px-6 max-w-7xl mx-auto")],
        [
          h.div(
            [h.Class("mt-8 border-t pt-8 space-y-2 text-center")],
            [
              h.a(
                [
                  h.Href(viewInputs.privacyHref),
                  h.Class(
                    "text-sm text-muted-foreground underline underline-offset-4",
                  ),
                ],
                ["プライバシーポリシー"],
              ),
              h.p(
                [h.Class("text-sm text-muted-foreground")],
                [copyrightText(model.maybeCurrentYear)],
              ),
            ],
          ),
        ],
      ),
    ],
  );

export const view = Submodel.defineView<Model, Message, ViewInputs>(
  (model, viewInputs, h) =>
    h.div(
      [h.Class("flex min-h-screen flex-col")],
      [
        headerView(model, viewInputs, h),
        h.main([h.Class("flex-1")], [heroView(h), servicesView(h)]),
        footerView(model, viewInputs, h),
      ],
    ),
);
