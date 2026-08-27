/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAPBOX_TOKEN: string;
  /** A Mapbox Studio style URL. Falls back to the stock light style. */
  readonly VITE_MAP_STYLE?: string;
  /** "true" to list the roads on offer beside the map. See `site/flags.ts`. */
  readonly VITE_TURNINGS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
