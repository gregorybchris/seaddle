import type { Map as MapboxMap } from "mapbox-gl";

/**
 * The grounds a map can be drawn on, each a re-tint of the stock light style.
 *
 * The spec asks for a custom Studio style. It does not have to be built in
 * Studio: `light-v11` is fifty layers whose every color is a flat
 * `hsl(220, n%, l%)` grey, so a basemap is really a table of replacement
 * colors, and a table is something this repository can hold, review, and diff.
 * Keeping it here also keeps the style out of the bundle — Mapbox still serves
 * the layers and the tiles, and we send it a few dozen overrides.
 *
 * The one thing every ground has to survive is the route drawn on top of it.
 * Those lines run green (#1c4632 through #86b06a), amber and rust (#c98a2e
 * through #7d2b1c), and one grey-olive (#97967f). So none of these carries a
 * mid green, an amber, or a rust anywhere, and land stays light enough that the
 * olive still reads against it.
 */
export type BasemapId = "paper" | "sand" | "field" | "harbor" | "lagoon";

type Palette = {
  /** Everything that is not water, park, or building. */
  land: string;
  /** The road web, which the stock style draws flat white at every class — the
   *  hierarchy between a motorway and an alley is width, not color, so a single
   *  replacement keeps it. */
  road: string;
  /** Casings at bridges and tunnel mouths, which is the only depth roads get. */
  roadCase: string;
  /** Footpaths, cycleways, steps, rail. Quiet on purpose: the routes are the
   *  cycling information here, and a basemap cycleway competing with a drawn
   *  segment is worse than no cycleway at all. */
  path: string;
  water: string;
  green: string;
  /** How loudly parks read, 0–1. */
  greenOpacity: number;
  building: string;
  buildingEdge: string;
  /** 0 hides buildings outright. */
  buildingOpacity: number;
  boundary: string;
  /** Roads and major places / mid-rank places and nature / water and subdivisions. */
  labelStrong: string;
  labelMid: string;
  labelSoft: string;
  halo: string;
  /** Whether shop and landmark pins are drawn at all. */
  poi: boolean;
};

export type Basemap = {
  id: BasemapId;
  name: string;
  palette: Palette;
};

export const BASEMAPS: Basemap[] = [
  // Warm and near-monochrome. Recedes hardest, so the route carries every
  // bit of the color on screen.
  {
    id: "paper",
    name: "Paper",
    palette: {
      land: "#faf7f1",
      road: "#ffffff",
      roadCase: "#ece4d6",
      path: "#f3ece1",
      water: "#dae0e0",
      green: "#ebeade",
      greenOpacity: 0.55,
      building: "#f2ece1",
      buildingEdge: "#e8dfd0",
      buildingOpacity: 0.9,
      boundary: "#cfc7b8",
      labelStrong: "#6a635a",
      labelMid: "#8b8478",
      labelSoft: "#a49c8f",
      halo: "#faf7f1",
      poi: false,
    },
  },
  // Sand land against a slate-blue Puget Sound. Water gets real presence,
  // which is most of how anyone orients in Seattle.
  {
    id: "sand",
    name: "Sand & slate",
    palette: {
      land: "#f4eee1",
      road: "#fffdf7",
      roadCase: "#e5dbc6",
      path: "#ece3d2",
      water: "#c7d3d9",
      green: "#e1e5d3",
      greenOpacity: 0.7,
      building: "#ebe3d2",
      buildingEdge: "#dbcfba",
      buildingOpacity: 1,
      boundary: "#c2b7a3",
      labelStrong: "#5d5850",
      labelMid: "#837c6f",
      labelSoft: "#a09786",
      halo: "#f6f1e6",
      poi: false,
    },
  },
  // Trail-map convention: cream land, parks that read, pale blue water,
  // landmarks left on. The closest to the wta.org spirit the spec names.
  {
    id: "field",
    name: "Field guide",
    palette: {
      land: "#f8f3e8",
      road: "#ffffff",
      roadCase: "#e9e0cd",
      path: "#e8ddc6",
      water: "#cfdde5",
      green: "#dde8d2",
      greenOpacity: 0.9,
      building: "#f0e9da",
      buildingEdge: "#e2d9c6",
      buildingOpacity: 0.75,
      boundary: "#c8bda8",
      labelStrong: "#5a5446",
      labelMid: "#857d6b",
      labelSoft: "#a69d89",
      halo: "#f8f3e8",
      poi: true,
    },
  },

  // The three above are quiet by design. These two put a hue on the ground on
  // purpose, and both still keep land above 90% lightness and borrow a hue the
  // route encoding does not use — which is the only reason a colored ground can
  // work here at all. Saturating toward green, amber, or rust would start
  // eating the ramps.

  // Blue water and a cool white ground. The more conventional of the two, and
  // the easiest of any of them to read a coastline off.
  {
    id: "harbor",
    name: "Harbor",
    palette: {
      land: "#eef3f7",
      road: "#ffffff",
      roadCase: "#d4e0ea",
      path: "#e2ebf2",
      water: "#8fb8d4",
      green: "#dce8e4",
      greenOpacity: 0.6,
      building: "#e3ecf3",
      buildingEdge: "#cfdde8",
      buildingOpacity: 0.9,
      boundary: "#a9c0d2",
      labelStrong: "#3f5a70",
      labelMid: "#6b8399",
      labelSoft: "#93a8ba",
      halo: "#eef3f7",
      poi: false,
    },
  },

  // Cream against a real teal. Reads like a chart of somewhere warmer than
  // this one, which is either the appeal or the objection.
  {
    id: "lagoon",
    name: "Lagoon",
    palette: {
      land: "#fdf6e8",
      road: "#ffffff",
      roadCase: "#e8dcc0",
      path: "#f0e6cd",
      water: "#7ec5c0",
      green: "#e4ecd3",
      greenOpacity: 0.75,
      building: "#f4ead2",
      buildingEdge: "#e5d8b8",
      buildingOpacity: 0.85,
      boundary: "#c9b98f",
      labelStrong: "#4a5a52",
      labelMid: "#7a8a80",
      labelSoft: "#9caaa0",
      halo: "#fdf6e8",
      poi: true,
    },
  },
];

/**
 * What a rider gets before they have chosen anything.
 *
 * Field guide rather than the quietest option: someone opening the map for the
 * first time is orienting, not yet reading a route, and parks and landmarks are
 * what they orient by.
 */
export const DEFAULT_BASEMAP: BasemapId = "field";

/** Roads proper — one flat color across every class, as the stock style has it. */
const ROADS = ["road-simple", "tunnel-simple", "bridge-simple", "aeroway-line"];

/** Paths, steps, and rail: everything drawn thin and meant to stay quiet. */
const PATHS = [
  "road-path",
  "road-path-trail",
  "road-path-cycleway-piste",
  "road-steps",
  "road-pedestrian",
  "bridge-path",
  "bridge-path-trail",
  "bridge-path-cycleway-piste",
  "bridge-steps",
  "bridge-pedestrian",
  "bridge-rail",
  "tunnel-path",
  "tunnel-path-trail",
  "tunnel-path-cycleway-piste",
  "tunnel-steps",
  "tunnel-pedestrian",
  "road-rail",
];

const STRONG_LABELS = [
  "road-label-simple",
  "state-label",
  "country-label",
  "continent-label",
  "airport-label",
];

const MID_LABELS = ["natural-line-label", "natural-point-label", "poi-label"];

const SOFT_LABELS = [
  "waterway-label",
  "water-line-label",
  "water-point-label",
  "settlement-subdivision-label",
];

/** Place names the stock style already fades by rank; the tiers are kept and
 *  only re-colored, because a city and a neighborhood should not weigh alike. */
const RANKED_LABELS = ["settlement-major-label", "settlement-minor-label"];

/** The paint properties a variant touches. Named rather than left as `string`
 *  because mapbox-gl types the setter against its own union and will not take
 *  a widened one. */
type PaintProperty =
  | "background-color"
  | "fill-color"
  | "fill-opacity"
  | "fill-outline-color"
  | "line-color"
  | "text-color"
  | "text-halo-color";

type Rule = [layer: string, property: PaintProperty, value: unknown];

function rules(p: Palette): Rule[] {
  return [
    ["land", "background-color", p.land],
    ["land-structure-polygon", "fill-color", p.land],
    ["land-structure-line", "line-color", p.land],
    ["aeroway-polygon", "fill-color", p.road],

    ["water", "fill-color", p.water],
    ["waterway", "line-color", p.water],

    ["landuse", "fill-color", p.green],
    ["national-park", "fill-color", p.green],
    // The stock curve fades parks in at z5 and back out at z12. Kept, scaled.
    [
      "national-park",
      "fill-opacity",
      [
        "interpolate",
        ["linear"],
        ["zoom"],
        5,
        0,
        7,
        p.greenOpacity,
        12,
        p.greenOpacity * 0.5,
      ],
    ],

    ["building", "fill-color", p.building],
    ["building", "fill-outline-color", p.buildingEdge],
    // Buildings arrive between z15 and z16 in the stock style. Kept, so a
    // hidden-buildings variant is a ceiling of zero rather than a popped layer.
    [
      "building",
      "fill-opacity",
      ["interpolate", ["linear"], ["zoom"], 15, 0, 16, p.buildingOpacity],
    ],

    ["admin-0-boundary", "line-color", p.boundary],
    ["admin-1-boundary", "line-color", p.boundary],
    ["admin-0-boundary-disputed", "line-color", p.boundary],
    ["admin-0-boundary-bg", "line-color", p.boundary],
    ["admin-1-boundary-bg", "line-color", p.boundary],

    ["bridge-case-simple", "line-color", p.roadCase],
    ...ROADS.map((id): Rule => [id, "line-color", p.road]),
    ...PATHS.map((id): Rule => [id, "line-color", p.path]),

    ...STRONG_LABELS.map((id): Rule => [id, "text-color", p.labelStrong]),
    ...MID_LABELS.map((id): Rule => [id, "text-color", p.labelMid]),
    ...SOFT_LABELS.map((id): Rule => [id, "text-color", p.labelSoft]),
    ...RANKED_LABELS.map(
      (id): Rule => [
        id,
        "text-color",
        [
          "step",
          ["get", "symbolrank"],
          p.labelStrong,
          11,
          p.labelMid,
          16,
          p.labelSoft,
        ],
      ],
    ),
    ...[...STRONG_LABELS, ...MID_LABELS, ...SOFT_LABELS, ...RANKED_LABELS].map(
      (id): Rule => [id, "text-halo-color", p.halo],
    ),
  ];
}

/** The setter as this file needs it: one signature for every property. */
type LooseSetter = {
  setPaintProperty(layer: string, property: string, value: unknown): void;
};

/**
 * Set one paint property from the table above.
 *
 * mapbox-gl types the value against the *specific* property being set, which a
 * table of mixed rules cannot satisfy — a `line-color` and a `fill-opacity` do
 * not share a value type. The pairings here are checked by hand instead, which
 * is what the layer names already required.
 */
function set(
  map: MapboxMap,
  layer: string,
  property: PaintProperty,
  value: unknown,
): void {
  // Widen the map, not the method. Pulling `setPaintProperty` off into a local
  // to cast it detaches it from the map, and it throws on the `this` it no
  // longer has — which is exactly what took the page down the first time.
  (map as unknown as LooseSetter).setPaintProperty(layer, property, value);
}

/**
 * Re-tint a loaded map in place.
 *
 * Every variant writes the same set of properties, so switching between them
 * leaves no residue from the one before and none of this needs a style reload —
 * the swap is immediate, which is the whole point of reviewing them this way.
 */
export function applyBasemap(map: MapboxMap, basemap: Basemap): void {
  for (const [layer, property, value] of rules(basemap.palette)) {
    if (!map.getLayer(layer)) continue;
    set(map, layer, property, value);
  }
  if (map.getLayer("poi-label")) {
    map.setLayoutProperty(
      "poi-label",
      "visibility",
      basemap.palette.poi ? "visible" : "none",
    );
  }
}
