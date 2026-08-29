import { BASEMAPS, type Basemap, type BasemapId } from "@/lib/basemap";
import { cn } from "@/lib/utilities/style-utils";

/**
 * Which ground the map is drawn on, offered as four small maps.
 *
 * A row of chips with a dot on each said the names and one invented color, so
 * choosing meant picking a word, closing the dialog, and looking. A palette is
 * the only honest description of itself — so each one draws its own map here
 * instead, the same shoreline and street web and park painted four ways.
 * Picking becomes recognising rather than remembering, which is the move the
 * color dialog next door already makes.
 *
 * Every one of them carries a route, cased and green. That is not decoration:
 * the note `basemap.ts` opens with is that the one thing a ground has to
 * survive is the route drawn on top of it, and a rider choosing between these
 * is choosing what their route will be read against rather than a wallpaper.
 *
 * Two by two, with the name over the drawing rather than beside it. The four
 * are being compared rather than read down, and a square block puts every
 * answer within one glance of every other — which is what a comparison wants
 * and what a column of rows makes you scroll for. The name goes above because
 * the drawing is the wide part: hung off the side it would leave the map a
 * strip, and a strip is too little of a map to recognise anything in.
 */
export function BasemapChoices({
  value,
  onChange,
}: {
  value: BasemapId;
  onChange: (id: BasemapId) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Map style"
      className="grid grid-cols-2 gap-2"
    >
      {BASEMAPS.map((basemap) => (
        <Choice
          key={basemap.id}
          basemap={basemap}
          chosen={basemap.id === value}
          onChoose={() => onChange(basemap.id)}
        />
      ))}
    </div>
  );
}

/** One ground: its name, and the map it makes. */
function Choice({
  basemap,
  chosen,
  onChoose,
}: {
  basemap: Basemap;
  chosen: boolean;
  onChoose: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      onClick={onChoose}
      className={cn(
        "focus-visible:ring-blaze flex flex-col gap-1 rounded-lg border px-2 py-1.5 text-left",
        "transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none",
        chosen
          ? "border-blaze/60 bg-blaze/10"
          : "border-sand/15 hover:border-sand/40 hover:bg-sand/5",
      )}
    >
      <span
        className={cn("px-0.5 text-xs", chosen ? "text-sand" : "text-sand/85")}
      >
        {basemap.name}
      </span>
      <Thumbnail
        basemap={basemap}
        // A ring for the reason the ramp swatches have one: every ground here
        // is land above 90% lightness, and without an edge the palest of them
        // bleeds into this dialog's forest and loses its own shape.
        className="ring-forest-deep/40 aspect-[16/9] w-full rounded ring-1"
      />
    </button>
  );
}

/**
 * A shoreline, a bay in the corner, and a web of streets — held out here so the
 * casing pass and the color pass draw the same roads rather than two lists that
 * can drift apart.
 *
 * Cut close in, at about the zoom a rider actually builds a route at, which is
 * what makes the drawing look like a map at all: pulled back far enough to hold
 * the whole city, land becomes a ribbon between two seas and every palette
 * turns into a stripe. Here land is most of the frame, water arrives from two
 * corners, and the differences between the four show up where they really do —
 * in how loudly the water and the parks read against a ground that is nearly
 * white in all of them.
 *
 * Wide and short — 16:9 rather than anything nearer a square — because the
 * height is the whole dialog's budget: four tiles and their names are most of
 * what stands between the settings and a scrollbar, and every row of pixels
 * here costs two down the panel. The shapes were re-fitted to the shorter frame
 * rather than the drawing being squashed into it, and the streets were left
 * alone, so the blocks stay square and only the window onto them gets smaller.
 */
const BAY =
  "M0 33 C14 38 22 46 32 52 C44 59 54 64 62 74 C68 82 70 87 72 90 H0 Z";
const LAKE = "M160 0 V43 C147 40 137 34 131 24 C126 16 123 7 123 0 Z";

/** The ordinary streets. Spaced by hand rather than by a step, because an exact
 *  grid reads as ruled paper — and close enough together that the web stays
 *  texture: spread out to match the size of the tile it would read as a wider
 *  city seen from lower down, which is a different picture than the one the
 *  shoreline and the parks are drawing. */
const CROSS = [-10, -1, 8, 16, 25, 33, 52, 60, 69, 77, 85, 94, 102, 110];
const DOWN = [
  5, 13, 22, 30, 39, 47, 56, 64, 85, 93, 102, 110, 119, 127, 136, 144, 153,
];

/** Two arterials and a diagonal. Wider, not darker: the stock style draws every
 *  road class the same white and lets width carry the hierarchy, which is the
 *  whole reason `applyBasemap` can replace them all with one color. */
const MAJOR = ["M-20 43 H180", "M76 -20 V130", "M-12 116 L116 -12"];

const ROUTE =
  "M62 69 C68 66 68 62 74 57 C86 54 88 46 100 41 C110 36 116 33 126 29";

function Thumbnail({
  basemap,
  className,
}: {
  basemap: Basemap;
  className?: string;
}) {
  const p = basemap.palette;
  const web = (roads: string[], width: number, color: string) => (
    <g stroke={color} strokeWidth={width}>
      {roads.map((d) => (
        <path key={d} d={d} />
      ))}
    </g>
  );
  const minor = [
    ...CROSS.map((y) => `M-20 ${y} H180`),
    ...DOWN.map((x) => `M${x} -20 V130`),
  ];

  return (
    <svg aria-hidden viewBox="0 0 160 90" className={className}>
      <rect width="160" height="90" fill={p.land} />

      {/* Parks under the streets, where the real style has them, and at the
          opacity it fades them in to — so the one ground that lets its greens
          carry still does here. */}
      <g fill={p.green} opacity={p.greenOpacity}>
        <path d="M4 7 C10 1 24 0 34 4 C42 7 47 14 43 20 C39 25 28 25 22 28 C15 32 5 29 3 23 C1 17 1 11 4 7 Z" />
        <path d="M104 49 C114 43 130 45 135 52 C140 60 134 69 124 71 C114 74 104 70 101 63 C98 56 99 53 104 49 Z" />
        <path d="M64 75 C74 70 90 72 95 79 C100 85 93 92 82 93 C71 94 62 90 61 83 C60 79 61 77 64 75 Z" />
        <path d="M52 11 C58 9 66 11 67 15 C68 20 62 23 56 21 C51 20 49 14 52 11 Z" />
      </g>

      {/* Cased under, which the real style keeps for bridge decks alone: three
          of these four paint their roads pure white on land a shade off it, and
          at a tenth of the size the web vanishes without an edge to it.
          `roadCase` is the palette's own answer to what the edge of a road
          looks like, so borrowing it invents no color.

          Turned off true north because a city grid never is, and a drawing of
          one that is reads as ruled paper. The lines run well past the frame so
          the rotation cannot open a gap at a corner. */}
      <g fill="none" transform="rotate(-7 80 45)">
        {web(minor, 1.7, p.roadCase)}
        {web(minor, 0.85, p.road)}
        {web(MAJOR, 2.9, p.roadCase)}
        {web(MAJOR, 1.7, p.road)}
      </g>

      {/* Water over the streets, because a shoreline is the one edge here that
          has to stay clean: it is most of what tells the four apart. */}
      <g fill={p.water}>
        <path d={BAY} />
        <path d={LAKE} />
      </g>

      {/* A route: cased in the dark and left its own color, which is how the
          map draws one and the whole of what a ground has to survive. */}
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={ROUTE} stroke="var(--color-forest-deep)" strokeWidth="4.6" />
        <path d={ROUTE} stroke="var(--color-moss)" strokeWidth="2.4" />
      </g>
      {/* Its ends, marked the way the map marks them: the live end moss with a
          dark edge, the far end dark with a pale one. */}
      <circle
        cx="62"
        cy="69"
        r="3"
        fill="var(--color-moss)"
        stroke="var(--color-forest-deep)"
      />
      <circle
        cx="126"
        cy="29"
        r="3"
        fill="var(--color-forest-deep)"
        stroke={p.land}
      />
    </svg>
  );
}
