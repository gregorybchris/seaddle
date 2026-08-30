/**
 * Prints every user-facing string in the site as one reviewable list.
 *
 * Read out of the source rather than walked out of the DOM because most of this
 * copy only appears in a state you have to work to reach — an empty panel, a
 * basemap that failed, the confirm on a route that was never saved. The source
 * has all of them at once, and in an order a reviewer can hold.
 *
 * Admin is left out on purpose: it never ships, so its copy is not the site's.
 */
import ts from "typescript";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["src/site", "src/widgets", "src/pages"];

/** Attributes whose value a reader sees, or hears read out. */
const COPY_PROPS = new Set([
  "title",
  "label",
  "aria-label",
  "aria-description",
  "placeholder",
  "alt",
  "headline",
  "hint",
  "note",
  "summary",
  "description",
  "caption",
  "empty",
  "emptyLabel",
  "confirmLabel",
  "cancelLabel",
  "action",
  "heading",
  "legend",
  "unit",
  "suffix",
  "prefix",
]);

/** Attributes that hold machinery, never prose. */
const SKIP_PROPS = new Set([
  "className",
  "class",
  "id",
  "key",
  "href",
  "src",
  "type",
  "role",
  "value",
  "htmlFor",
  "style",
  "color",
  "fill",
  "stroke",
  "weight",
  "viewBox",
  "d",
  "rel",
  "target",
  "as",
  "variant",
  "size",
  "side",
  "align",
  "tone",
  "icon",
  "name",
  "mode",
  "kind",
  "field",
  "slot",
  "path",
  "transform",
]);

type Hit = { file: string; line: number; kind: string; text: string };

/**
 * A Tailwind class list, a CSS function, a token. These reach the same string
 * literals prose does, and there are more of them than there is copy.
 */
function isMachinery(text: string): boolean {
  if (/^[a-z-]+\(/.test(text)) return true; // linear-gradient(…), translateX(…)
  if (/^[MLCHVZAQST][\d\s.,-]/i.test(text) && !/[a-z]{2}/.test(text))
    return true; // SVG path data
  if (/^(--|var\()/.test(text)) return true;
  const tokens = text.split(/\s+/).filter(Boolean);
  const classish = tokens.filter(
    (token) =>
      /[:[]/.test(token) ||
      /^-?[a-z]+(-[a-z0-9.]+)+$/.test(token) ||
      /\//.test(token) ||
      /^(flex|grid|block|inline|hidden|absolute|relative|fixed|sticky|truncate|contents)$/.test(
        token,
      ),
  );
  return classish.length / tokens.length > 0.5;
}

/** Prose, as against an identifier, a token, a key, a class name. */
function looksLikeProse(value: string): boolean {
  const text = value.trim();
  if (text.length < 2 || !/[A-Za-z]/.test(text)) return false;
  if (/^[a-z0-9-]+$/.test(text) && !/^[a-z]+$/.test(text)) return false;
  if (/^[a-z]+([A-Z][a-z]*)+$/.test(text)) return false;
  if (/^#|^https?:|^\/|^data:|^[A-Z0-9_]{3,}$/.test(text)) return false;
  if (/^\d+(\.\d+)?(px|rem|em|%|s|ms|vh|vw)?$/.test(text)) return false;
  return !isMachinery(text);
}

/** Everything a JSX element renders as one run of words, holes included. */
function flatten(node: ts.Node): string {
  if (ts.isJsxText(node)) return node.text;
  if (ts.isJsxExpression(node)) return "{…}";
  if (ts.isJsxSelfClosingElement(node)) return "";
  if (ts.isJsxElement(node)) return node.children.map(flatten).join("");
  if (ts.isJsxFragment(node)) return node.children.map(flatten).join("");
  return "";
}

const hits: Hit[] = [];

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sources(path);
    if (!/\.tsx?$/.test(path)) return [];
    if (/\.test\.tsx?$|test-fixtures/.test(path)) return [];
    return [path];
  });
}

for (const root of ROOTS) {
  for (const file of sources(root)) {
    const source = ts.createSourceFile(
      file,
      readFileSync(file, "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const consumed = new Set<ts.Node>();
    const record = (node: ts.Node, kind: string, raw: string) => {
      const text = raw.replace(/\s+/g, " ").trim();
      if (!looksLikeProse(text)) return;
      const line =
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      hits.push({ file: relative(process.cwd(), file), line, kind, text });
    };

    const visit = (node: ts.Node) => {
      const isElement = ts.isJsxElement(node) || ts.isJsxFragment(node);
      // Record whole elements, so a sentence broken over <strong> or {value}
      // arrives as the sentence a reader gets rather than as three fragments.
      if (isElement && !consumed.has(node)) {
        const children = (node as ts.JsxElement | ts.JsxFragment).children;
        if (
          children.some(
            (child) => ts.isJsxText(child) && /[A-Za-z]/.test(child.text),
          )
        ) {
          const flat = flatten(node);
          if (/[A-Za-z]/.test(flat)) {
            record(node, "text", flat);
            const claim = (inner: ts.Node) => {
              consumed.add(inner);
              ts.forEachChild(inner, claim);
            };
            claim(node);
          }
        }
      }
      if (ts.isJsxAttribute(node) && node.initializer) {
        const attribute = node.name.getText(source);
        const init = node.initializer;
        const literal = ts.isStringLiteral(init)
          ? init
          : ts.isJsxExpression(init) &&
              init.expression &&
              (ts.isStringLiteral(init.expression) ||
                ts.isNoSubstitutionTemplateLiteral(init.expression))
            ? init.expression
            : undefined;
        if (
          literal &&
          !SKIP_PROPS.has(attribute) &&
          (COPY_PROPS.has(attribute) || literal.text.includes(" "))
        ) {
          record(node, attribute, literal.text);
        }
      } else if (
        ts.isStringLiteral(node) ||
        ts.isNoSubstitutionTemplateLiteral(node)
      ) {
        const parent = node.parent;
        const isAttribute =
          ts.isJsxAttribute(parent) ||
          (ts.isJsxExpression(parent) &&
            parent.parent &&
            ts.isJsxAttribute(parent.parent));
        const isModulePath =
          ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent);
        const isKey = ts.isPropertyAssignment(parent) && parent.name === node;
        if (
          !isAttribute &&
          !isModulePath &&
          !isKey &&
          node.text.includes(" ")
        ) {
          record(node, "string", node.text);
        }
      } else if (ts.isTemplateExpression(node)) {
        const parts = [
          node.head.text,
          ...node.templateSpans.map((span) => span.literal.text),
        ];
        record(node, "template", parts.join("{…}"));
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
}

/**
 * Constructions that read as machine-written. Flags, not verdicts — an em dash
 * is fine in one line of copy and tiresome in ten, and the only way to notice
 * the tenth is to see all ten together.
 */
const TICS: [RegExp, string][] = [
  [
    /\bis not (a |an |the )?[\w ]+ but\b|\bnot just\b[^.]*\bbut\b|\bisn'?t (just )?[\w ]+, it'?s\b/i,
    "not-X-but-Y",
  ],
  [/—/, "em-dash"],
  [
    /\b(seamless|robust|leverage|utilize|delve|elevate|unlock|empower|effortless|crucial|vital|comprehensive|holistic|curated|realm|landscape|tapestry|testament|journey)\w*\b/i,
    "LLM-vocab",
  ],
  [/\b[\w']+, [\w']+,? and [\w']+\b/, "triad"],
  [
    /\bevery \w+ (carries|has|holds|comes with|tells|knows)\b/i,
    "every-X-carries",
  ],
  [/\b(simply|effortlessly|easily)\b/i, "adverb-reassurance"],
  [/\bwhether [^.]* or\b/i, "whether-or"],
  [/\b(helps? you|lets? you|so you can|allows? you)\b/i, "benefit-splice"],
  [/\b(\w+) your (\w+), \1 your\b/i, "anaphora"],
  [/\byou'?ll\b.*!|!$|^(oops|oh no|great|nice|perfect|awesome)\b/i, "chirpy"],
  [
    /\b(may be|might be|can be) (recommended|preferred|suggested)\b|\bof course\b|\bplease note\b/i,
    "hedge",
  ],
  [
    /\b(individual|various|specific|certain|particular) \w+s\b|\bthe attributes of\b/i,
    "filler-adjective",
  ],
  [/\bwhen you'?re ready\b|\bfeel free to\b|\bdon'?t worry\b/i, "hand-holding"],
];

// The markup outside React: the tab title, what a link preview says, and the
// paragraph a crawler that runs no scripts is left with. Read as text rather
// than parsed, because there are six tags and no parser in the dependencies.
const markup = readFileSync("index.html", "utf8");
for (const [pattern, kind] of [
  [/<title>([^<]+)<\/title>/g, "title"],
  [/<meta\s+name="description"\s+content="([^"]+)"/g, "meta description"],
  [
    /<meta\s+(?:property|name)="(?:og|twitter):(?:title|description|image:alt)"\s+content="([^"]+)"/g,
    "social",
  ],
  [/"description":\s*"([^"]+)"/g, "structured data"],
] as [RegExp, string][]) {
  for (const match of markup.matchAll(pattern)) {
    const line = markup.slice(0, match.index ?? 0).split("\n").length;
    hits.push({
      file: "index.html",
      line,
      kind,
      text: match[1].replace(/\s+/g, " ").trim(),
    });
  }
}
for (const match of markup.matchAll(/<noscript>([\s\S]*?)<\/noscript>/g)) {
  for (const paragraph of match[1].matchAll(/<(h1|p)>([\s\S]*?)<\/\1>/g)) {
    const line = markup.slice(0, match.index ?? 0).split("\n").length;
    hits.push({
      file: "index.html",
      line,
      kind: "noscript",
      text: paragraph[2].replace(/\s+/g, " ").trim(),
    });
  }
}

const seen = new Set<string>();
const unique = hits.filter((hit) => {
  const key = `${hit.file}|${hit.text}`;
  return seen.has(key) ? false : (seen.add(key), true);
});

const SPOKEN = new Set(["aria-label", "aria-description", "alt", "title"]);
const words = (hit: Hit) => hit.text.split(/\s+/).length;

const buckets: [string, string, Hit[]][] = [
  [
    "Prose",
    "Read every one of these closely. This is where voice lives.",
    unique.filter((hit) => !SPOKEN.has(hit.kind) && words(hit) >= 5),
  ],
  [
    "Labels and buttons",
    "Skim for the odd one out — a verb that does not match its neighbours.",
    unique.filter((hit) => !SPOKEN.has(hit.kind) && words(hit) < 5),
  ],
  [
    "Heard, not seen",
    "Screen reader and tooltip text. Check it says the same thing the visible label does.",
    unique.filter((hit) => SPOKEN.has(hit.kind)),
  ],
];

const tally = new Map<string, number>();
const lines: string[] = [];

for (const [name, note, list] of buckets) {
  lines.push(`\n# ${name} (${list.length})\n\n> ${note}\n`);
  const byFile = new Map<string, Hit[]>();
  for (const hit of list)
    byFile.set(hit.file, [...(byFile.get(hit.file) ?? []), hit]);
  for (const [file, rows] of [...byFile].sort()) {
    lines.push(`\n## ${file}\n`);
    for (const hit of rows.sort((a, b) => a.line - b.line)) {
      const flags = TICS.filter(([re]) => re.test(hit.text)).map(
        ([, tic]) => tic,
      );
      for (const flag of flags) tally.set(flag, (tally.get(flag) ?? 0) + 1);
      lines.push(`- [ ] ${hit.text}`);
      lines.push(
        `      \`${hit.file}:${hit.line}\` *(${hit.kind})*${flags.length ? ` **⚑ ${flags.join(" · ")}**` : ""}`,
      );
    }
  }
}

console.log(
  [
    `# Copy inventory`,
    ``,
    `${unique.length} strings across ${new Set(unique.map((h) => h.file)).size} files.`,
    ``,
    `Tics: ` +
      ([...tally]
        .sort((a, b) => b[1] - a[1])
        .map(([tic, n]) => `${tic} ${n}`)
        .join(", ") || "none"),
    ...lines,
  ].join("\n"),
);
