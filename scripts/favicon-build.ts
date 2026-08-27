/**
 * Builds the favicons from the mark component, so the tab icon and the app can
 * never drift apart.
 *
 * Two things are worth knowing before editing this.
 *
 * First, the outputs are committed, unlike the other derived files in this
 * repo. Rasterising needs `rsvg-convert` and ImageMagick, and neither is on the
 * deploy image — so this runs on a laptop when the mark changes, not on every
 * build. Run `pnpm favicon:build` and commit what it writes.
 *
 * Second, sizes at or below 32px drop the bicycle and keep only the top of the
 * Needle. The full mark is a bicycle drawn in hairlines, and at 16px those
 * hairlines land on a third of a pixel each and gray out into a smudge. The
 * saucer survives that reduction — it is the half of the mark that is still
 * recognisably itself at tab size, and it carries the blaze accent.
 *
 * Requires: rsvg-convert (librsvg), magick (ImageMagick 7).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { BLAZE, FOREST, MARK, SAND, SAUCER, markPaths } from "./lib/mark";

const publicDir = fileURLToPath(new URL("../public", import.meta.url));

/** Everything is drawn at 512 and scaled down, so one master serves every size. */
const CANVAS = 512;
const CORNER = 112;

/** Fits a box from the mark's coordinate space into the canvas, centered. */
function fit(
  box: { x: number; y: number; w: number; h: number },
  coverage: number,
) {
  const scale = (CANVAS * coverage) / Math.max(box.w, box.h);
  const tx = (CANVAS - box.w * scale) / 2 - box.x * scale;
  const ty = (CANVAS - box.h * scale) / 2 - box.y * scale;
  return `translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale.toFixed(4)})`;
}

function svg(
  note: string,
  transform: string,
  sand: string[],
  blaze: string,
  square = false,
) {
  const ground = square
    ? `<rect width="${CANVAS}" height="${CANVAS}" fill="${FOREST}"/>`
    : `<rect width="${CANVAS}" height="${CANVAS}" rx="${CORNER}" fill="${FOREST}"/>`;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}">`,
    `  <!-- ${note} Generated from src/widgets/seaddle-mark.tsx by pnpm favicon:build. -->`,
    `  ${ground}`,
    `  <g transform="${transform}">`,
    ...sand.map((d) => `    <path fill="${SAND}" d="${d}"/>`),
    `    <path fill="${BLAZE}" d="${blaze}"/>`,
    `  </g>`,
    `</svg>`,
    "",
  ].join("\n");
}

const { structure, blaze, saucer } = markPaths();
const full = { ...MARK, w: MARK.size, h: MARK.size };

/** The tab icon: small enough that only the saucer survives, so only it is drawn. */
const small = svg(
  "The top of the Needle, for tab-sized icons.",
  fit(SAUCER, 0.78),
  saucer,
  blaze,
);
/** The whole mark, for anywhere the bicycle still reads. */
const large = svg(
  "The Seaddle mark on the site palette.",
  fit(full, 0.78),
  structure,
  blaze,
);
/** iOS masks the icon itself, and a rounded ground would leave gaps at the corners. */
const touch = svg(
  "The Seaddle mark, squared for iOS masking.",
  fit(full, 0.78),
  structure,
  blaze,
  true,
);

const work = mkdtempSync(join(tmpdir(), "seaddle-favicon-"));
try {
  const render = (source: string, size: number, out: string) => {
    execFileSync("rsvg-convert", [
      "-w",
      String(size),
      "-h",
      String(size),
      source,
      "-o",
      out,
    ]);
    return out;
  };
  const smallFile = join(work, "small.svg");
  const largeFile = join(work, "large.svg");
  const touchFile = join(work, "touch.svg");
  writeFileSync(smallFile, small);
  writeFileSync(largeFile, large);
  writeFileSync(touchFile, touch);

  writeFileSync(join(publicDir, "favicon.svg"), small);
  writeFileSync(join(publicDir, "icon.svg"), large);
  render(touchFile, 180, join(publicDir, "apple-touch-icon.png"));

  const frames = [
    render(smallFile, 16, join(work, "16.png")),
    render(smallFile, 32, join(work, "32.png")),
    render(largeFile, 48, join(work, "48.png")),
  ];
  execFileSync("magick", [...frames, join(publicDir, "favicon.ico")]);
} finally {
  rmSync(work, { recursive: true, force: true });
}

console.log("favicons written to public/");
