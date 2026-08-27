/**
 * The Seaddle mark, read out of the component that draws it.
 *
 * Both the favicons and the social card are rasterised from the same source
 * the app renders, so an edit to the mark cannot leave a stale copy behind in
 * a committed PNG.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** The site palette, from src/globals.css. */
export const FOREST = "#1c4632";
export const SAND = "#e9e0d0";
export const BLAZE = "#d97b2e";

/** The mark's own viewBox, and the box the top of the Needle occupies in it. */
export const MARK = { x: 7.8, y: 7.7, size: 134.4 };
export const SAUCER = { x: 53.2, y: 7.7, w: 43.6, h: 68.8 };

const markFile = fileURLToPath(
  new URL("../../src/widgets/seaddle-mark.tsx", import.meta.url),
);

export function markPaths() {
  const source = readFileSync(markFile, "utf8");
  const paths = [...source.matchAll(/d="([^"]+)"/g)].map((m) => m[1]);
  /**
   * The slicing below is positional, so a changed mark should stop the build
   * rather than quietly ship the wrong shapes.
   */
  if (paths.length !== 6) {
    throw new Error(`expected 6 paths in the mark, found ${paths.length}`);
  }
  if (
    !/text-blaze[\s\S]*?d="/.test(source.slice(source.lastIndexOf("<path")))
  ) {
    throw new Error(
      "expected the last path in the mark to be the blaze accent",
    );
  }
  return {
    structure: paths.slice(0, 5),
    blaze: paths[5],
    saucer: paths.slice(3, 5),
  };
}
