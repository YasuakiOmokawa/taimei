import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WEB_ROOT = path.resolve(import.meta.dirname, "../..");
const WEB_SRC = path.join(WEB_ROOT, "src");
const DOMAIN_PROJECTS = path.join(WEB_ROOT, "domain-projects");

const LAYERS_OUTSIDE_DOMAINS = new Set(["app", "shared", "__tests__"]);
const BOOTSTRAP_FILES = new Set(["main.ts", "index.css", "CLAUDE.md"]);
const TECHNICAL_DIRS = new Set(["lib", "components"]);
const PROJECTS_OUTSIDE_INDEX = new Set(["base.json", "index.json"]);

type Entry = { readonly path: string; readonly isDirectory: boolean };

type Tree = {
  readonly entries: readonly Entry[];
  readonly projects: ReadonlyMap<string, readonly string[]>;
  readonly indexReferences: readonly string[];
};

const isDomain = (name: string) => !LAYERS_OUTSIDE_DOMAINS.has(name);

type Located = {
  readonly segments: readonly string[];
  readonly name: string;
  readonly isDirectory: boolean;
};

const PLACEMENT_RULES: readonly {
  readonly violates: (entry: Located) => boolean;
  readonly message: string;
}[] = [
  {
    violates: ({ segments, name, isDirectory }) =>
      segments.length === 1 && !isDirectory && !BOOTSTRAP_FILES.has(name),
    message: `web/src の直下に置ける file は ${[...BOOTSTRAP_FILES].join("・")} だけ。domain か app か shared の dir に移す`,
  },
  {
    violates: ({ name, isDirectory }) =>
      isDirectory && TECHNICAL_DIRS.has(name),
    message:
      "lib・components の dir は置かない。置く file は使う domain の dir か shared に、中身を表す名前で置く",
  },
  {
    violates: ({ name, isDirectory }) => !isDirectory && name === "index.ts",
    message:
      "barrel (index.ts) は書かない。使う側は中身の file を直に import する",
  },
  {
    violates: ({ segments, name, isDirectory }) =>
      isDirectory &&
      name === "pages" &&
      !(segments.length === 2 && isDomain(segments[0] ?? "")),
    message:
      "page は <domain>/pages/ にだけ置く (app と shared と試験は page を持たない)",
  },
];

const placementViolations = ({ path: entryPath, isDirectory }: Entry) => {
  const segments = entryPath.split("/");
  const located = { segments, name: segments.at(-1) ?? "", isDirectory };
  return PLACEMENT_RULES.filter(({ violates }) => violates(located)).map(
    ({ message }) => `${message}: web/src/${entryPath}`,
  );
};

const isRegisteredDomain = (projects: Tree["projects"], domain: string) =>
  [`${domain}.json`, `${domain}.pages.json`].every(
    (project) =>
      (projects.get(project) ?? []).length > 0 &&
      (projects.get(project) ?? []).every((include) =>
        include.startsWith(`../src/${domain}/`),
      ),
  );

const structureViolations = ({ entries, projects, indexReferences }: Tree) => {
  const referenced = new Set(indexReferences);
  return [
    ...entries.flatMap(placementViolations),
    ...entries
      .filter(
        ({ path: entryPath, isDirectory }) =>
          isDirectory &&
          !entryPath.includes("/") &&
          isDomain(entryPath) &&
          !isRegisteredDomain(projects, entryPath),
      )
      .map(
        ({ path: entryPath }) =>
          `domain の dir は、include がどれも ../src/<domain>/ で始まる web/domain-projects/<domain>.json と <domain>.pages.json を持ち、index.json から参照する (無いと tsc -b が境界を見ない): web/src/${entryPath}`,
      ),
    ...[...projects.keys()]
      .filter(
        (project) =>
          !PROJECTS_OUTSIDE_INDEX.has(project) && !referenced.has(project),
      )
      .map(
        (project) =>
          `web/domain-projects/index.json は ${project} を references に持つ (無いと bun run typecheck が build しない): web/domain-projects/${project}`,
      ),
  ];
};

type ProjectDefinition = {
  readonly include?: readonly string[];
  readonly references?: readonly { readonly path: string }[];
};

const readProject = (project: string): ProjectDefinition =>
  JSON.parse(readFileSync(path.join(DOMAIN_PROJECTS, project), "utf8"));

const actualTree = (): Tree => ({
  entries: readdirSync(WEB_SRC, { recursive: true, withFileTypes: true })
    .filter((dirent) => !dirent.name.startsWith("."))
    .map((dirent) => ({
      path: path.relative(WEB_SRC, path.join(dirent.parentPath, dirent.name)),
      isDirectory: dirent.isDirectory(),
    })),
  projects: new Map(
    readdirSync(DOMAIN_PROJECTS)
      .filter((project) => project.endsWith(".json"))
      .map((project) => [project, readProject(project).include ?? []]),
  ),
  indexReferences: (readProject("index.json").references ?? []).map(
    ({ path: reference }) => path.basename(reference),
  ),
});

const REGISTERED = {
  projects: new Map([
    ["base.json", []],
    ["index.json", []],
    ["team.json", ["../src/team/**/*.ts"]],
    ["team.pages.json", ["../src/team/pages/**/*.ts"]],
  ]),
  indexReferences: ["team.json", "team.pages.json"],
};

const file = (entryPath: string): Entry => ({
  path: entryPath,
  isDirectory: false,
});
const dir = (entryPath: string): Entry => ({
  path: entryPath,
  isDirectory: true,
});

describe("web/src の構造", () => {
  it.each([
    ["team/lib", dir("team/lib")],
    ["shared/components", dir("shared/components")],
    ["team/index.ts", file("team/index.ts")],
    ["app/pages", dir("app/pages")],
    ["team/pages/nested/pages", dir("team/pages/nested/pages")],
    ["team/sub/pages", dir("team/sub/pages")],
    ["helper.ts", file("helper.ts")],
    ["unregistered", dir("unregistered")],
  ])("%s を違反として挙げる", (entryPath, entry) => {
    expect(
      structureViolations({ ...REGISTERED, entries: [entry] }).join("\n"),
    ).toContain(`: web/src/${entryPath}`);
  });

  it("include が別の dir を指すか空の domain の project を違反として挙げる (写した定義の直し忘れ)", () => {
    expect(
      structureViolations({
        ...REGISTERED,
        projects: new Map([
          ...REGISTERED.projects,
          ["copied.json", ["../src/team/**/*.ts"]],
          ["copied.pages.json", ["../src/copied/pages/**/*.ts"]],
          ["empty.json", []],
          ["empty.pages.json", ["../src/empty/pages/**/*.ts"]],
        ]),
        indexReferences: [
          ...REGISTERED.indexReferences,
          "copied.json",
          "copied.pages.json",
          "empty.json",
          "empty.pages.json",
        ],
        entries: [dir("copied"), dir("empty")],
      }),
    ).toEqual([
      expect.stringContaining(": web/src/copied"),
      expect.stringContaining(": web/src/empty"),
    ]);
  });

  it("index.json が参照しない project を違反として挙げる", () => {
    expect(
      structureViolations({
        ...REGISTERED,
        entries: [],
        indexReferences: ["team.json"],
      }),
    ).toEqual([
      expect.stringContaining(": web/domain-projects/team.pages.json"),
    ]);
  });

  it("登録した domain の pages・試験・app・shared・直下の起動の file は違反にならない", () => {
    expect(
      structureViolations({
        ...REGISTERED,
        entries: [
          dir("team"),
          dir("team/pages"),
          file("team/pages/Team.ts"),
          dir("team/__tests__"),
          dir("app"),
          dir("shared/ui"),
          dir("__tests__/acceptance"),
          file("main.ts"),
          file("index.css"),
          file("CLAUDE.md"),
        ],
      }),
    ).toEqual([]);
  });

  it("今の web/src と web/domain-projects に違反が無い", () => {
    expect(structureViolations(actualTree())).toEqual([]);
  });
});
