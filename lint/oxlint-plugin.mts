type AstNode = {
  readonly type: string;
  readonly name?: string;
  readonly value?: unknown;
  readonly computed?: boolean;
  readonly object?: AstNode;
  readonly property?: AstNode;
  readonly callee?: AstNode;
  readonly key?: AstNode;
  readonly source?: AstNode | null;
  readonly imported?: AstNode;
  readonly local?: AstNode;
  readonly importKind?: string;
  readonly body?: readonly AstNode[];
  readonly parent?: AstNode;
};

type Scope = {
  readonly set: ReadonlyMap<string, unknown>;
  readonly upper: Scope | null;
};

type RuleContext = {
  readonly report: (descriptor: {
    readonly node: AstNode;
    readonly message: string;
  }) => void;
  readonly sourceCode: {
    readonly getAncestors: (node: AstNode) => readonly AstNode[];
    readonly getScope: (node: AstNode) => Scope;
  };
};

type Visitors = Readonly<Record<string, (node: AstNode) => void>>;

const memberPathOf = (node: AstNode | undefined): string => {
  if (node?.type === "Identifier") {
    return node.name ?? "";
  }
  if (node?.type === "MemberExpression" && node.computed !== true) {
    return `${memberPathOf(node.object)}.${node.property?.name ?? ""}`;
  }
  return "";
};

const BROWSER_GLOBALS = new Set([
  "window",
  "document",
  "navigator",
  "location",
  "history",
  "fetch",
]);

const TIMER_GLOBALS = new Set([
  "setTimeout",
  "setInterval",
  "requestAnimationFrame",
]);

const FORM_ELEMENTS = new Set(["button", "input", "textarea", "select"]);

const SVG_ELEMENTS = new Set(["svg"]);

const APPLICATION_STARTS = new Set(
  ["embed", "hydrate", "makeApplication", "makeElement", "run"].map(
    (name) => `Runtime.${name}`,
  ),
);

const DEFERRED_EFFECT_CONSTRUCTORS = new Set(
  ["sync", "try", "tryPromise", "promise", "suspend", "callback"].map(
    (name) => `Effect.${name}`,
  ),
);

const isDeferredByRuntime = (node: AstNode) =>
  (node.type === "Property" && node.key?.name === "execute") ||
  (node.type === "CallExpression" &&
    DEFERRED_EFFECT_CONSTRUCTORS.has(memberPathOf(node.callee)));

const isDeclaredIn = (scope: Scope | null, name: string): boolean =>
  scope !== null && (scope.set.has(name) || isDeclaredIn(scope.upper, name));

const namedNode = (parent: AstNode | undefined) =>
  parent?.type === "MemberExpression" ? parent.property : parent?.key;

const isPropertyName = (node: AstNode) =>
  node.parent?.computed !== true && namedNode(node.parent) === node;

const isGlobalReference = (context: RuleContext, node: AstNode, name: string) =>
  !isPropertyName(node) &&
  !isDeclaredIn(context.sourceCode.getScope(node), name);

const noElementOfH = (
  elements: ReadonlySet<string>,
  messageOf: (element: string) => string,
) => ({
  create: (context: RuleContext): Visitors => ({
    MemberExpression: (node) => {
      const element = node.property?.name ?? "";
      if (
        node.computed !== true &&
        node.object?.name === "h" &&
        elements.has(element)
      ) {
        context.report({ node, message: messageOf(element) });
      }
    },
  }),
});

const noEffectRunInWeb = {
  create: (context: RuleContext): Visitors => ({
    MemberExpression: (node) => {
      if (memberPathOf(node).startsWith("Effect.run")) {
        context.report({
          node,
          message:
            "web の画面は Effect を自分で走らせない。Foldkit の update か init が Command を返し、runtime が走らせる",
        });
      }
    },
  }),
};

const noBrowserGlobalOutsideCommand = {
  create: (context: RuleContext): Visitors => ({
    Identifier: (node) => {
      const name = node.name ?? "";
      if (
        BROWSER_GLOBALS.has(name) &&
        isGlobalReference(context, node, name) &&
        !context.sourceCode.getAncestors(node).some(isDeferredByRuntime)
      ) {
        context.report({
          node,
          message: `Foldkit の update・view・init は ${name} に触れない。Command の execute か、Effect.sync などの中に置く`,
        });
      }
    },
  }),
};

const noTimerInWeb = {
  create: (context: RuleContext): Visitors => ({
    Identifier: (node) => {
      const name = node.name ?? "";
      if (TIMER_GLOBALS.has(name) && isGlobalReference(context, node, name)) {
        context.report({
          node,
          message: `web の画面は ${name} を使わない。待つのは Effect.sleep、次の描画は Foldkit の Subscription で書く`,
        });
      }
    },
  }),
};

const APPLICATION_START_MESSAGE =
  "は web/src/app/start-application.ts の startApplication だけが呼ぶ (resources の渡し忘れを型で止めるため)";

const RUNTIME_ALIAS_MESSAGE =
  "Foldkit の Runtime は別名や namespace で import しない (application を起動する関数を startApplication の外で呼ぶ code を lint が見つけられなくなる)";

const RUNTIME_SOURCES: ReadonlySet<unknown> = new Set([
  "foldkit",
  "foldkit/runtime",
]);

const isTypeOnlyImport = (specifier: AstNode) =>
  specifier.importKind === "type" || specifier.parent?.importKind === "type";

const sourceOf = (specifier: AstNode) => specifier.parent?.source?.value;

const importsApplicationStart = (specifier: AstNode) =>
  sourceOf(specifier) === "foldkit/runtime" &&
  APPLICATION_STARTS.has(`Runtime.${specifier.imported?.name}`);

const aliasesRuntime = (specifier: AstNode) =>
  sourceOf(specifier) === "foldkit" &&
  specifier.imported?.name === "Runtime" &&
  specifier.local?.name !== "Runtime" &&
  !isTypeOnlyImport(specifier);

const noDirectApplicationStart = {
  create: (context: RuleContext): Visitors => ({
    MemberExpression: (node) => {
      const path = memberPathOf(node);
      if (APPLICATION_STARTS.has(path)) {
        context.report({
          node,
          message: `${path} ${APPLICATION_START_MESSAGE}`,
        });
      }
    },
    ImportSpecifier: (node) => {
      if (importsApplicationStart(node)) {
        context.report({
          node,
          message: `${node.imported?.name} ${APPLICATION_START_MESSAGE}`,
        });
      }
      if (aliasesRuntime(node)) {
        context.report({ node, message: RUNTIME_ALIAS_MESSAGE });
      }
    },
    ImportNamespaceSpecifier: (node) => {
      if (RUNTIME_SOURCES.has(sourceOf(node)) && !isTypeOnlyImport(node)) {
        context.report({ node, message: RUNTIME_ALIAS_MESSAGE });
      }
    },
  }),
};

const noSwitch = {
  create: (context: RuleContext): Visitors => ({
    SwitchStatement: (node) => {
      context.report({
        node,
        message:
          "tag ごとに分ける処理は switch ではなく Match.valueTags の表にする (fallow audit が変えた関数の CRAP で落とす)",
      });
    },
  }),
};

export default {
  meta: { name: "taimei" },
  rules: {
    "no-effect-run-in-web": noEffectRunInWeb,
    "no-browser-global-outside-command": noBrowserGlobalOutsideCommand,
    "no-timer-in-web": noTimerInWeb,
    "no-raw-form-element": noElementOfH(
      FORM_ELEMENTS,
      (element) =>
        `h.${element} は web/src/shared/ui/ の部品だけが書く。画面は shared/ui/ の部品を使う`,
    ),
    "no-raw-svg-element": noElementOfH(
      SVG_ELEMENTS,
      () =>
        "<svg> を手で書かない。icon は lucide から取り、web/src/shared/ui/icon-view.ts の部品で描く",
    ),
    "no-direct-application-start": noDirectApplicationStart,
    "no-switch": noSwitch,
  },
};
