/**
 * Which basemap the themes are drawn on top of.
 *
 * `light-v11` is not a placeholder any more: the grounds in `basemap.ts` are
 * re-tints of *its* layers, addressed by name, so this is load-bearing rather
 * than a default. Pointing `VITE_MAP_STYLE` at a Mapbox Studio style still
 * works and still needs no code change — but a style built on anything other
 * than the classic Streets layer names will not match those layer ids, and the
 * re-tint quietly does nothing rather than failing. Themes and a custom Studio
 * style are alternatives to each other, not a stack.
 */
export const MAP_STYLE =
  import.meta.env.VITE_MAP_STYLE || "mapbox://styles/mapbox/light-v11";
