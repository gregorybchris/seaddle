import {
  ArrowUUpLeft,
  ArrowsLeftRight,
  DownloadSimple,
  Trash,
} from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/utilities/style-utils";
import { formatFeet, formatMiles } from "@/lib/utilities/units";
import { Button } from "@/widgets/button";
import { ElevationProfile } from "@/widgets/elevation-profile";
import { SeaddleMark } from "@/widgets/seaddle-mark";
import { InfoPopover } from "@/widgets/info-popover";
import { Sheet } from "@/widgets/sheet";
import { downloadGpx } from "../download-gpx";
import type { Encoding, Filters } from "../filters";
import type { SiteGraph } from "../graph-data";
import {
  continuations,
  encodeRoute,
  isEmpty,
  routeGain,
  routeMeters,
  routePoints,
  type Route,
} from "../route";
import { useSavedRides, type SavedRide } from "../use-saved-rides";
import { FilterPanel } from "./filter-panel";
import { RouteBreakdown } from "./route-breakdown";

type RoutePanelProps = {
  graph: SiteGraph;
  route: Route;
  encoding: Encoding;
  onEncoding: (encoding: Encoding) => void;
  filters: Filters;
  onFilters: (filters: Filters) => void;
  passing: number;
  total: number;
  onUndo: () => void;
  onClear: () => void;
  onOutAndBack: () => void;
  onLoad: (encoded: string) => void;
  onScrub: (fraction: number | null) => void;
};

export function RoutePanel({
  graph,
  route,
  encoding,
  onEncoding,
  filters,
  onFilters,
  passing,
  total,
  onUndo,
  onClear,
  onOutAndBack,
  onLoad,
  onScrub,
}: RoutePanelProps) {
  // One owner for the saved list: a copy per component would let saving in one
  // place leave the other showing a stale list.
  const saved = useSavedRides();
  const meters = routeMeters(route, graph);
  const gain = routeGain(route, graph);
  const started = !isEmpty(route);
  const stuck = started && continuations(route, graph).size === 0;
  const ridden = route.steps
    .map((step) => graph.segments.get(step.segment))
    .filter((segment): segment is NonNullable<typeof segment> => !!segment);

  return (
    <Sheet
      raisedWhen={started}
      // The map is the thing here. Resting low keeps it in view while a start
      // is chosen, and rising only to half leaves the change a pick just made
      // visible instead of covering it.
      raisedTo="half"
      restingAt="peek"
      peek={
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <SeaddleMark className="text-sand h-8 w-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <h1 className="text-sand text-base leading-none tracking-[0.18em] uppercase">
                Seaddle
              </h1>
              <p className="eyebrow text-sand/70 mt-1">
                Seattle cycling routes
              </p>
            </div>
          </div>

          {/* Not dimmed before a ride starts. Fading a block of already-muted
              text compounds: 70% type inside a 70% wrapper lands near half
              strength and stops being readable. "0.0 mi" says "not yet" by
              itself. */}
          <div className="border-sand/10 flex items-end gap-6 border-t pt-3">
            <Figure label="distance" value={formatMiles(meters)} />
            <Figure
              label="climbing"
              value={
                gain.min === gain.max
                  ? formatFeet(gain.max)
                  : // One segment has no direction yet, and the two answers can
                    // differ by hundreds of feet.
                    `${Math.round(gain.min * 3.28084)}–${formatFeet(gain.max)}`
              }
            />
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {started ? (
          <>
            <ElevationProfile
              points={routePoints(route, graph)}
              onScrub={onScrub}
            />

            <RouteBreakdown segments={ridden} encoding={encoding} />

            {stuck && (
              <p className="border-blaze/40 bg-blaze/10 text-blaze rounded-lg border px-3 py-2 text-xs leading-relaxed">
                This is as far as the map goes that way. Undo and try another
                turn.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="flex-1" onClick={onUndo}>
                <ArrowUUpLeft weight="bold" className="h-4 w-4" />
                Undo
              </Button>
              <Button
                variant="outline"
                onClick={onOutAndBack}
                title="Ride the same way home"
              >
                <ArrowsLeftRight weight="bold" className="h-4 w-4" />
                And back
              </Button>
              <Button variant="quiet" onClick={onClear} aria-label="Start over">
                <Trash weight="bold" className="h-4 w-4" />
              </Button>
            </div>

            <SaveRide
              route={route}
              meters={meters}
              graph={graph}
              onSave={saved.save}
            />
          </>
        ) : (
          <p className="text-sand/75 text-sm leading-relaxed">
            Tap any road to start a ride. Keep tapping to add on new segments.
            Then save or export your route.
          </p>
        )}

        <FilterPanel
          filters={filters}
          onFilters={onFilters}
          encoding={encoding}
          onEncoding={onEncoding}
          passing={passing}
          total={total}
        />

        <SavedRides
          rides={saved.rides}
          onForget={saved.remove}
          onLoad={onLoad}
          current={encodeRoute(route)}
        />
      </div>
    </Sheet>
  );
}

/**
 * Keep this ride, and take it away as a file.
 *
 * Both are the same act from a rider's side — "I want this later" — so they sit
 * together rather than being scattered around the panel.
 */
function SaveRide({
  route,
  meters,
  graph,
  onSave,
}: {
  route: Route;
  meters: number;
  graph: SiteGraph;
  onSave: (name: string, route: string) => void;
}) {
  const [name, setName] = useState("");

  return (
    <div className="flex gap-2">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          onSave(name, encodeRoute(route));
          setName("");
        }}
        placeholder="Name this ride"
        aria-label="Name this ride"
        className="border-sand/15 bg-forest-deep/40 text-sand placeholder:text-sand/70 focus:border-blaze/60 min-w-0 flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors focus:outline-none"
      />
      <Button
        variant="outline"
        className="min-h-9 px-2 text-xs"
        onClick={() => {
          onSave(name, encodeRoute(route));
          setName("");
        }}
      >
        Save
      </Button>
      <Button
        variant="primary"
        className="min-h-9 px-2 text-xs"
        aria-label="Download as GPX"
        title="Download as GPX"
        onClick={() =>
          downloadGpx(
            routePoints(route, graph),
            name.trim() || `Seaddle ${formatMiles(meters)}`,
          )
        }
      >
        <DownloadSimple weight="bold" className="h-4 w-4" />
        GPX
      </Button>
    </div>
  );
}

/** Rides kept in this browser, newest first. */
function SavedRides({
  rides,
  onForget,
  onLoad,
  current,
}: {
  rides: SavedRide[];
  onForget: (id: string) => void;
  onLoad: (encoded: string) => void;
  current: string;
}) {
  if (rides.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow text-sand/70 flex items-center gap-1.5">
        Your rides
        <InfoPopover label="About saved rides">
          These live in this browser only — not in an account. Clearing your
          site data, or opening Seaddle somewhere else, will not bring them with
          you. Download a ride as GPX to keep it for good.
        </InfoPopover>
      </h2>
      <ul className="flex flex-col">
        {rides.map((ride) => (
          <li
            key={ride.id}
            className="border-sand/10 group flex items-center gap-2 border-b py-1.5 last:border-b-0"
          >
            <button
              type="button"
              onClick={() => onLoad(ride.route)}
              className={cn(
                "hover:text-blaze min-w-0 flex-1 truncate text-left text-xs transition-colors",
                ride.route === current ? "text-blaze" : "text-sand",
              )}
            >
              {ride.name}
            </button>
            <button
              type="button"
              onClick={() => onForget(ride.id)}
              aria-label={`Forget ${ride.name}`}
              className="text-sand/70 hover:text-blaze group-hover:text-sand/70 shrink-0 px-1 text-xs transition-colors"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="tabular text-sand text-xl leading-none">{value}</span>
      <span className="eyebrow text-sand/70">{label}</span>
    </div>
  );
}
