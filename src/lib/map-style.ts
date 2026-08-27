/**
 * Which basemap to draw under everything.
 *
 * Set `VITE_MAP_STYLE` to a Mapbox Studio style URL and both maps pick it up —
 * designing that style is work in Studio rather than in this repository, and it
 * should not need a code change to land. The stock light style is the stand-in
 * until then: muted enough that green route lines read against it, which is the
 * only thing the site actually asks of it.
 */
export const MAP_STYLE =
  import.meta.env.VITE_MAP_STYLE || "mapbox://styles/mapbox/light-v11";
