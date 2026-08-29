/**
 * Builds the social card — the image Slack, iMessage, and every search preview
 * show when someone shares the link.
 *
 * Like the favicons, the output is committed rather than built on deploy:
 * rasterising needs rsvg-convert, which is not on the deploy image. Run
 * `pnpm og:build` when the mark, the palette, or the graph changes enough to
 * matter, and commit what it writes.
 *
 * The card draws the real network. A social card is the one place the product
 * gets a single frame to say what it is, and "a web of segments with one path
 * picked out of it" is the whole idea — so the lines are the actual compiled
 * graph, and the blaze route is a real chain of segments walked out of it,
 * rather than decoration that would go stale the moment the graph grew.
 *
 * Requires: rsvg-convert (librsvg). Run `pnpm graph:build` first.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { FeatureCollection, LineString } from "geojson";
import { BLAZE, FOREST, MARK, SAND, markPaths } from "./lib/mark";
import { fontEnvironment } from "./lib/webfont";

const publicDir = fileURLToPath(new URL("../public", import.meta.url));
const indexHtml = fileURLToPath(new URL("../index.html", import.meta.url));

/**
 * The `v` on the `og:image` tag, which is a fingerprint of the card itself.
 *
 * A scraper caches the image against its URL, and most of them will never
 * fetch it again: Facebook and LinkedIn have debuggers, WhatsApp and iMessage
 * have nothing at all. So a redrawn card left at the same address is the old
 * card in every preview for as long as those caches hold it — months, with no
 * way to ask.
 *
 * Stamped here rather than typed into the markup because this script is run
 * once in a blue moon, which is exactly when a "remember to bump the version"
 * step is not remembered. The hash of the bytes changes when the card does and
 * never otherwise, so a rebuild that draws the same image leaves the markup —
 * and everyone's cached preview — alone.
 *
 * Eight hex digits, because the tag is written to the width Prettier keeps and
 * a fingerprint that changed length would reflow the line under it.
 */
const STAMP = /(content="https:\/\/seaddle\.com\/og\.png)(\?v=[0-9a-f]+)?(")/;

function stamp(png: Buffer): string {
  const version = createHash("sha256").update(png).digest("hex").slice(0, 8);
  const html = readFileSync(indexHtml, "utf8");
  if (!STAMP.test(html)) {
    throw new Error("no og:image tag in index.html to stamp the card into");
  }
  writeFileSync(indexHtml, html.replace(STAMP, `$1?v=${version}$3`));
  return version;
}

/** The size every scraper expects; anything else gets letterboxed by someone. */
const WIDTH = 1200;
const HEIGHT = 630;

/**
 * The square the network is fitted into, on the right of the card.
 *
 * The graph runs from Everett to Burien, so it is far taller than it is wide
 * and the fit is decided by the height. The square is therefore most of the
 * card tall and the drawing lands as a strip down the right of it; the x here
 * is the square's left edge, not the drawing's, which sits well inside it.
 */
const PLOT = { x: 618, y: 8, size: 612 };

/**
 * A step lighter than the panel green from globals.css. Scrapers show this
 * image around 360px wide, and at that size the network has to survive a 3x
 * reduction without dissolving into the ground it sits on.
 */
const NETWORK = "#2f7052";

/** How many segments the highlighted route runs for. */
const ROUTE_LENGTH = 12;

type Segment = {
  id: string;
  from: string;
  to: string;
  points: [number, number][];
};

function segments(): Segment[] {
  /**
   * The compiled runtime file rather than the authoring files, so the card is
   * drawn from exactly what the site loads.
   */
  const file = join(publicDir, "graph.geojson");
  const collection: FeatureCollection<LineString> = JSON.parse(
    readFileSync(file, "utf8"),
  );
  return collection.features.map((feature) => ({
    id: String(feature.properties?.id),
    from: String(feature.properties?.from),
    to: String(feature.properties?.to),
    points: feature.geometry.coordinates as [number, number][],
  }));
}

/**
 * Web Mercator, fitted to the plot square.
 *
 * Plate carrée would squash the city by a third at this latitude, and the
 * network is recognisably Seattle only if it keeps its shape.
 */
function projector(all: Segment[]) {
  /** Both axes end up in radians, or the city comes out 50x too wide. */
  const x = (lon: number) => (lon * Math.PI) / 180;
  const y = (lat: number) =>
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const points = all.flatMap((s) => s.points);
  const xs = points.map((p) => x(p[0]));
  const ys = points.map((p) => y(p[1]));
  const bounds = {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  };
  const scale =
    PLOT.size / Math.max(bounds.x1 - bounds.x0, bounds.y1 - bounds.y0);
  const padX = (PLOT.size - (bounds.x1 - bounds.x0) * scale) / 2;
  const padY = (PLOT.size - (bounds.y1 - bounds.y0) * scale) / 2;
  return (point: [number, number]) => [
    PLOT.x + padX + (x(point[0]) - bounds.x0) * scale,
    /** SVG y grows downward and latitude grows upward. */
    PLOT.y + PLOT.size - padY - (y(point[1]) - bounds.y0) * scale,
  ];
}

/**
 * Walks out the longest chain of distinct segments it can find, up to
 * ROUTE_LENGTH. Ties are broken by id so the card is the same every build.
 */
function route(all: Segment[]) {
  const byId = new Map(all.map((s) => [s.id, s]));
  const links = new Map<string, string[]>();
  for (const segment of [...all].sort((a, b) => a.id.localeCompare(b.id))) {
    for (const node of [segment.from, segment.to]) {
      links.set(node, [...(links.get(node) ?? []), segment.id]);
    }
  }

  let best: string[] = [];
  const walk = (node: string, used: Set<string>, chain: string[]) => {
    if (chain.length > best.length) best = [...chain];
    if (best.length >= ROUTE_LENGTH) return;
    for (const id of links.get(node) ?? []) {
      if (used.has(id)) continue;
      const segment = byId.get(id)!;
      used.add(id);
      chain.push(id);
      walk(segment.from === node ? segment.to : segment.from, used, chain);
      chain.pop();
      used.delete(id);
      if (best.length >= ROUTE_LENGTH) return;
    }
  };

  for (const node of [...links.keys()].sort()) {
    walk(node, new Set(), []);
    if (best.length >= ROUTE_LENGTH) break;
  }
  return new Set(best);
}

function polyline(
  segment: Segment,
  project: (p: [number, number]) => number[],
) {
  return segment.points
    .map((p) =>
      project(p)
        .map((n) => n.toFixed(1))
        .join(","),
    )
    .join(" ");
}

const all = segments();
const project = projector(all);
const highlighted = route(all);
const { structure, blaze } = markPaths();

/** The mark, scaled out of its own viewBox into a box on the card. */
const markScale = 118 / MARK.size;
const markTransform = `translate(${(80 - MARK.x * markScale).toFixed(2)} ${(150 - MARK.y * markScale).toFixed(2)}) scale(${markScale.toFixed(4)})`;

const card = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <!-- The Seaddle social card. Generated by pnpm og:build. -->
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${FOREST}"/>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
${all
  .filter((s) => !highlighted.has(s.id))
  .map(
    (s) =>
      `    <polyline stroke="${NETWORK}" stroke-width="3" points="${polyline(s, project)}"/>`,
  )
  .join("\n")}
${all
  .filter((s) => highlighted.has(s.id))
  .map(
    (s) =>
      `    <polyline stroke="${BLAZE}" stroke-width="6" points="${polyline(s, project)}"/>`,
  )
  .join("\n")}
  </g>
  <g transform="${markTransform}">
${structure.map((d) => `    <path fill="${SAND}" d="${d}"/>`).join("\n")}
    <path fill="${BLAZE}" d="${blaze}"/>
  </g>
  <text x="232" y="222" fill="${SAND}" font-family="Didact Gothic" font-size="68" letter-spacing="12.2">SEADDLE</text>
  <text x="235" y="266" fill="${BLAZE}" font-family="IBM Plex Mono" font-weight="500" font-size="21" letter-spacing="2.9">SEATTLE CYCLING ROUTES</text>
  <g fill="${SAND}" fill-opacity="0.78" font-family="Didact Gothic" font-size="31">
    <text x="80" y="382">Over 300 miles of beginner to intermediate</text>
    <text x="80" y="424">cycling routes around Seattle.</text>
  </g>
  <text x="80" y="556" fill="${SAND}" fill-opacity="0.45" font-family="IBM Plex Mono" font-weight="500" font-size="19" letter-spacing="2.4">SEADDLE.COM</text>
</svg>
`;

const png = join(publicDir, "og.png");
const work = mkdtempSync(join(tmpdir(), "seaddle-og-"));
try {
  const { env, listed } = fontEnvironment(work, [
    "node_modules/@fontsource/didact-gothic/files/didact-gothic-latin-400-normal.woff",
    "node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff",
  ]);
  for (const family of ["Didact Gothic", "IBM Plex Mono"]) {
    if (!listed.includes(family)) {
      throw new Error(
        `${family} did not reach fontconfig; the card would set in a fallback`,
      );
    }
  }

  const source = join(work, "og.svg");
  writeFileSync(source, card);
  execFileSync("rsvg-convert", [source, "-o", png], { env });
} finally {
  rmSync(work, { recursive: true, force: true });
}

const version = stamp(readFileSync(png));

console.log(
  `og.png written to public/ (${highlighted.size} of ${all.length} segments highlighted)`,
);
console.log(`index.html stamped with ?v=${version} — commit both`);
