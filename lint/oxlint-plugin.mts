type AstNode = {
  readonly type: string;
  readonly name?: string;
  readonly value?: unknown;
  readonly computed?: boolean;
  readonly object?: AstNode;
  readonly property?: AstNode;
  readonly callee?: AstNode;
  readonly left?: AstNode;
  readonly operator?: string;
  readonly key?: AstNode;
  readonly source?: AstNode | null;
  readonly imported?: AstNode;
  readonly local?: AstNode;
  readonly importKind?: string;
  readonly body?: readonly AstNode[];
  readonly specifiers?: readonly AstNode[];
  readonly parent?: AstNode;
};

type Scope = {
  readonly set: ReadonlyMap<string, unknown>;
  readonly upper: Scope | null;
};

type Comment = {
  readonly type: "Line" | "Block" | "Shebang";
  readonly value: string;
};

type RuleContext = {
  readonly report: (descriptor: {
    readonly node: AstNode | Comment;
    readonly message: string;
  }) => void;
  readonly sourceCode: {
    readonly getAncestors: (node: AstNode) => readonly AstNode[];
    readonly getScope: (node: AstNode) => Scope;
    readonly getAllComments: () => readonly Comment[];
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

const LEAVING_DOCUMENT_MESSAGE =
  "document を離れる書き方 (location.assign・replace・reload、location とその property への代入、foldkit/navigation の load) は web/src/shared/leave-spa.ts だけが書く。application はその口を Command の中で呼ぶ";

const LEAVING_DOCUMENT_CALLS = [
  ...["assign", "replace", "reload"].map((method) => `location.${method}`),
  "Navigation.load",
];

const LOCATION_OR_ITS_PROPERTY = /(^|\.)location(\.[A-Za-z]+)?$/;

const endsWithMemberPath = (path: string, suffix: string) =>
  path === suffix || path.endsWith(`.${suffix}`);

const leaveSpaOnlyInLeaveSpa = {
  create: (context: RuleContext): Visitors => {
    const report = (node: AstNode) =>
      context.report({ node, message: LEAVING_DOCUMENT_MESSAGE });
    return {
      MemberExpression: (node) => {
        const path = memberPathOf(node);
        if (
          LEAVING_DOCUMENT_CALLS.some((call) => endsWithMemberPath(path, call))
        ) {
          report(node);
        }
      },
      AssignmentExpression: (node) => {
        if (LOCATION_OR_ITS_PROPERTY.test(memberPathOf(node.left))) {
          report(node);
        }
      },
      ImportSpecifier: (node) => {
        if (
          sourceOf(node) === "foldkit/navigation" &&
          node.imported?.name === "load" &&
          !isTypeOnlyImport(node)
        ) {
          report(node);
        }
      },
      ImportNamespaceSpecifier: (node) => {
        if (
          sourceOf(node) === "foldkit/navigation" &&
          !isTypeOnlyImport(node)
        ) {
          report(node);
        }
      },
    };
  },
};

const isValueImportDeclaration = (statement: AstNode) =>
  statement.type === "ImportDeclaration" &&
  statement.importKind !== "type" &&
  !(
    (statement.specifiers ?? []).length > 0 &&
    (statement.specifiers ?? []).every(
      (specifier) => specifier.importKind === "type",
    )
  );

const isValueImportOf = (statement: AstNode, module: string) =>
  isValueImportDeclaration(statement) &&
  `/${statement.source?.value}`.endsWith(`/${module}`);

const leaveSpaImportOnlyInApp = {
  create: (context: RuleContext): Visitors => ({
    ImportDeclaration: (node) => {
      if (isValueImportOf(node, "leave-spa")) {
        context.report({
          node,
          message:
            "document を離れるのは application (web/src/app/**) だけ。page は結果を OutMessage で返し、application の update が web/src/shared/leave-spa.ts の口を Command の中で呼ぶ",
        });
      }
    },
  }),
};

const importsFoldkit = (program: AstNode) =>
  (program.body ?? []).some(
    (statement) =>
      isValueImportDeclaration(statement) &&
      /^(foldkit|@foldkit\/)/.test(String(statement.source?.value)),
  );

const spaHttpClientOnlyInFoldkitFiles = {
  create: (context: RuleContext): Visitors => ({
    Program: (program) => {
      if (importsFoldkit(program)) {
        return;
      }
      for (const statement of program.body ?? []) {
        if (isValueImportOf(statement, "spa-http-client")) {
          context.report({
            node: statement,
            message:
              "SpaHttpClient を使うのは Foldkit の file (Command の中) と application の起動 (web/src/app/*/entry.ts) だけ",
          });
        }
      }
    },
  }),
};

const FAILURE_LOOKUPS = new Set(
  ["Cause", "Exit"].flatMap((module) =>
    ["findErrorOption", "findError"].map((lookup) => `${module}.${lookup}`),
  ),
);

const causeLookupOnlyInFailureMessage = {
  create: (context: RuleContext): Visitors => ({
    MemberExpression: (node) => {
      if (FAILURE_LOOKUPS.has(memberPathOf(node))) {
        context.report({
          node,
          message:
            "Cause・Exit から失敗を取り出す (findErrorOption・findError) のは web/src/shared/failure-message.ts だけ。画面は failureMessageOf で文言に替える",
        });
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

const LINE_DIRECTIVES = [
  /^\/\s*<reference/,
  /^\s*@ts-expect-error/,
  /^\s*oxlint-disable-next-line\s/,
];

const BLOCK_DIRECTIVES = [/^\s*oxlint-disable-next-line\s/, /^\s*@vite-ignore/];

const isDirective = (comment: Comment) =>
  comment.type === "Shebang" ||
  (comment.type === "Line" ? LINE_DIRECTIVES : BLOCK_DIRECTIVES).some(
    (directive) => directive.test(comment.value),
  );

const noCodeComment = {
  create: (context: RuleContext): Visitors => ({
    Program: () => {
      for (const comment of context.sourceCode.getAllComments()) {
        if (!isDirective(comment)) {
          context.report({
            node: comment,
            message:
              "コードにコメントを書かない (Foldkit の skill が挙げる // MODEL などの見出しと // NOTE も)。理由は名前・型・共有定数・test 名へ移す。書けるのは、この file に効く directive (@ts-expect-error・oxlint-disable-next-line <rule>・/// <reference・@vite-ignore) だけ。biome-ignore は、Biome が lint しないこの file では効かない",
          });
        }
      }
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
    "leave-spa-only-in-leave-spa": leaveSpaOnlyInLeaveSpa,
    "leave-spa-import-only-in-app": leaveSpaImportOnlyInApp,
    "spa-http-client-only-in-foldkit-files": spaHttpClientOnlyInFoldkitFiles,
    "cause-lookup-only-in-failure-message": causeLookupOnlyInFailureMessage,
    "no-switch": noSwitch,
    "no-code-comment": noCodeComment,
  },
};
