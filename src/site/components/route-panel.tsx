import {
  ArrowUUpLeft,
  ArrowUUpRight,
  ArrowsLeftRight,
  DownloadSimple,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/utilities/style-utils";
import { feet, formatFeet, formatMiles } from "@/lib/utilities/units";
import { Button } from "@/widgets/button";
import { ElevationProfile } from "@/widgets/elevation-profile";
import { SeaddleMark } from "@/widgets/seaddle-mark";
import { InfoPopover } from "@/widgets/info-popover";
import { Sheet } from "@/widgets/sheet";
import { downloadGpx } from "../download-gpx";
import type { Encoding } from "../filters";
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
import type { SegmentId } from "@/lib/models/graph";
import { SHOW_TURNINGS } from "../flags";
import type { Turning } from "../turnings";
import { useSavedRides, type SavedRide } from "../use-saved-rides";
import { RouteBreakdown } from "./route-breakdown";
import { TurningsList } from "./turnings-list";

/** What the undo keys are called on this machine, for the button tooltips. */
const MOD =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    ? "\u2318"
    : "Ctrl+";

type RoutePanelProps = {
  graph: SiteGraph;
  route: Route;
  encoding: Encoding;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClear: () => void;
  onOutAndBack: () => void;
  onLoad: (encoded: string) => void;
  onScrub: (fraction: number | null) => void;
  /** The roads that can be taken next, for picking without the map. */
  turnings: Turning[];
  onPick: (id: SegmentId) => void;
  onHighlight: (id: SegmentId | null) => void;
};

export function RoutePanel({
  graph,
  route,
  encoding,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClear,
  onOutAndBack,
  onLoad,
  onScrub,
  turnings,
  onPick,
  onHighlight,
}: RoutePanelProps) {
  // One owner for the saved list: a copy per component would let saving in one
  // place leave the other showing a stale list.
  const saved = useSavedRides();
  const meters = routeMeters(route, graph);
  const gain = routeGain(route, graph);
  const started = !isEmpty(route);
  const onward = started ? continuations(route, graph).size : 0;
  const stuck = started && onward === 0;
  const ridden = route.steps
    .map((step) => graph.segments.get(step.segment))
    .filter((segment): segment is NonNullable<typeof segment> => !!segment);

  /**
   * Nothing on first arrival — there is no news in a page having just loaded,
   * and a reader landing here is about to be read the panel anyway. An empty
   * route only has something to say once it got that way by being undone.
   */
  const announcement = !started
    ? canRedo
      ? "Ride cleared."
      : ""
    : stuck
      ? `${formatMiles(meters)}, ${climbText(gain)} of climbing. No roads continue from here.`
      : `${formatMiles(meters)}, ${climbText(gain)} of climbing. ` +
        `${onward} ${onward === 1 ? "road" : "roads"} on from here.`;

  return (
    <Sheet
      label="Your ride"
      headerAt="desktop"
      raisedWhen={started}
      // The map is the thing here. Resting low keeps it in view while a start
      // is chosen, and rising only to half leaves the change a pick just made
      // visible instead of covering it.
      raisedTo="half"
      restingAt="peek"
      header={
        <div className="flex items-center gap-3">
          <SeaddleMark className="text-sand h-8 w-8 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-sand text-base leading-none tracking-[0.18em] uppercase">
              Seaddle
            </h1>
            <p className="eyebrow text-sand/70 mt-1">Seattle cycling routes</p>
          </div>
        </div>
      }
      /* Not dimmed before a ride starts. Fading a block of already-muted text
         compounds: 70% type inside a 70% wrapper lands near half strength and
         stops being readable. "0.0 mi" says "not yet" by itself. */
      peek={
        <div className="border-sand/10 flex items-end gap-6 border-t pt-3 max-md:border-t-0 max-md:pt-0">
          <Figure label="distance" value={formatMiles(meters)} />
          <Figure label="climbing" value={climbText(gain)} />
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* What just happened, for a reader who cannot see the map redraw.
            Picking a road is a click on a canvas: nothing about it lands in the
            document, so without this the whole interaction is silent. */}
        <p role="status" aria-live="polite" className="sr-only">
          {announcement}
        </p>

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
          </>
        ) : (
          <p className="text-sand/75 text-sm leading-relaxed">
            Tap any road to start a ride. Keep tapping to add on new segments.
            Then save or export your route.
          </p>
        )}

        {/* Still here once a route has been undone away to nothing, because
            that is exactly the moment Redo is the thing being reached for. */}
        {(started || canRedo) && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onUndo}
              disabled={!canUndo}
              title={`Undo (${MOD}Z)`}
            >
              <ArrowUUpLeft weight="bold" className="h-4 w-4" />
              Undo
            </Button>
            <Button
              variant="outline"
              className="flex-1"
              onClick={onRedo}
              disabled={!canRedo}
              title={`Redo (${MOD}\u21e7Z)`}
            >
              <ArrowUUpRight weight="bold" className="h-4 w-4" />
              Redo
            </Button>
            {started && (
              <>
                <Button
                  variant="outline"
                  onClick={onOutAndBack}
                  title="Ride the same way home"
                >
                  <ArrowsLeftRight weight="bold" className="h-4 w-4" />
                  And back
                </Button>
                <Button
                  variant="quiet"
                  onClick={onClear}
                  aria-label="Start over"
                >
                  <Trash weight="bold" className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        )}

        {SHOW_TURNINGS && (
          <TurningsList
            turnings={turnings}
            started={started}
            onPick={onPick}
            onHighlight={onHighlight}
          />
        )}

        {started && (
          <SaveRide
            route={route}
            meters={meters}
            graph={graph}
            onSave={saved.save}
          />
        )}

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
    <div className="border-sand/10 flex gap-2 border-t pt-3">
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
        className="border-sand/15 bg-forest-deep/40 text-sand placeholder:text-sand/70 focus:border-blaze/60 focus:ring-blaze min-h-11 min-w-0 flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors focus:ring-2 focus:outline-none"
      />
      <Button
        variant="outline"
        className="px-2 text-xs"
        onClick={() => {
          onSave(name, encodeRoute(route));
          setName("");
        }}
      >
        Save
      </Button>
      <Button
        variant="primary"
        className="px-2 text-xs"
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
              aria-current={ride.route === current ? "true" : undefined}
              className={cn(
                "hover:text-blaze focus-visible:ring-blaze min-h-11 min-w-0 flex-1 truncate",
                "rounded text-left text-xs transition-colors",
                "focus-visible:ring-2 focus-visible:outline-none",
                ride.route === current ? "text-blaze" : "text-sand",
              )}
            >
              {ride.name}
            </button>
            <button
              type="button"
              onClick={() => onForget(ride.id)}
              aria-label={`Forget ${ride.name}`}
              className="text-sand/70 hover:text-blaze focus-visible:ring-blaze flex h-11 w-11 shrink-0 items-center justify-center rounded transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <X weight="bold" aria-hidden className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * How much climbing, in one phrase.
 *
 * A single segment has no direction yet and the two answers can differ by
 * hundreds of feet, so it reads as a range rather than picking a side and
 * quietly lying. Shared between the figure and what gets read aloud, because
 * the two disagreeing would be worse than either being wrong.
 */
function climbText(gain: { min: number; max: number }): string {
  if (gain.min === gain.max) return formatFeet(gain.max);
  return `${Math.round(feet(gain.min))}–${formatFeet(gain.max)}`;
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="tabular text-sand text-xl leading-none">{value}</span>
      <span className="eyebrow text-sand/70">{label}</span>
    </div>
  );
}
