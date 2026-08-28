import {
  ArrowUUpLeft,
  ArrowUUpRight,
  CursorClick,
  DownloadSimple,
  HandTap,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utilities/style-utils";
import { feet, formatFeet, formatMiles } from "@/lib/utilities/units";
import { Button } from "@/widgets/button";
import { ConfirmDialog } from "@/widgets/confirm-dialog";
import { ElevationProfile } from "@/widgets/elevation-profile";
import { SeaddleMark } from "@/widgets/seaddle-mark";
import { InfoPopover } from "@/widgets/info-popover";
import { Sheet } from "@/widgets/sheet";
import { downloadGpx } from "../download-gpx";
import type { Encoding } from "../encoding";
import type { SiteGraph } from "../graph-data";
import {
  continuations,
  encodeRoute,
  isEmpty,
  routeGain,
  routeMeters,
  routePoints,
  routeSegments,
  type Route,
} from "../route";
import type { ElevCoord } from "@/lib/models/geo";
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

/**
 * What picking a road is called on this machine, and what it is done with.
 *
 * The one instruction a first-time rider is given should name the gesture they
 * actually have. Decided by whether the pointer can hover rather than by screen
 * width, because it is the input being described and not the layout — a small
 * window on a laptop is still a mouse.
 */
const POINTING =
  typeof window !== "undefined" &&
  window.matchMedia?.("(hover: hover)").matches;
const PICK = POINTING ? "Click" : "Tap";
const PickIcon = POINTING ? CursorClick : HandTap;

type RoutePanelProps = {
  graph: SiteGraph;
  route: Route;
  encoding: Encoding;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClear: () => void;
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
  onLoad,
  onScrub,
  turnings,
  onPick,
  onHighlight,
}: RoutePanelProps) {
  // One owner for the saved list: a copy per component would let saving in one
  // place leave the other showing a stale list.
  const saved = useSavedRides();
  // Every point of the ride, and the reader drags along the chart: recomputing
  // it on each of those renders is walking the whole route per pointer move.
  const points = useMemo(() => routePoints(route, graph), [route, graph]);
  const meters = routeMeters(route, graph);
  const gain = routeGain(route, graph);
  const started = !isEmpty(route);
  const onward = started ? continuations(route, graph).size : 0;
  const stuck = started && onward === 0;
  const ridden = routeSegments(route, graph);

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
      // The map is the thing here, and the first pick is a change on the map:
      // rising to meet it would cover the very road that was just chosen. The
      // panel stays low and the pinned slot carries the reading, so the ride
      // is read where it is being drawn and the panel comes up when it is
      // asked for.
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
      /* The one slot pinned at every resting height, so whatever sits here is
         what a rider sees without touching anything. Before a ride starts that
         should be how to start one: two zeros are not a reading, they are the
         absence of one, and they were holding the most visible place on the
         screen against the only sentence that had somewhere to send anybody. */
      peek={
        started ? (
          <div className="border-sand/10 flex items-end gap-6 border-t pt-3 max-md:border-t-0 max-md:pt-0">
            <Figure label="distance" value={formatMiles(meters)} />
            <Figure label="climbing" value={climbText(gain)} />
          </div>
        ) : (
          <StartHere />
        )
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
            {/* Gone while the sheet is down, where all it could show is the
                top inch of itself under the buttons. */}
            <ElevationProfile
              points={points}
              onScrub={onScrub}
              className="max-md:group-data-[collapsed]/sheet:hidden"
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
          <HowItWorks />
        )}

        {/* Lifted to the top of the scroll on a phone, where the panel rests
            low and everything below the fold costs a drag: taking a pick back
            is the move a rider makes most, so it is the one that should be in
            reach without one. The sidebar has no fold to be under, so there it
            stays where it reads — after the ride it acts on.

            Still here once a route has been undone away to nothing, because
            that is exactly the moment Redo is the thing being reached for. */}
        {(started || canRedo) && (
          <div className="flex flex-wrap gap-2 max-md:order-first">
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
              <Button
                variant="danger"
                className="px-2 text-xs"
                onClick={onClear}
              >
                <Trash weight="bold" className="h-4 w-4" />
                Start over
              </Button>
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
            points={points}
            meters={meters}
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
 * The invitation to begin, in the panel's pinned slot.
 *
 * Said the way a first-time rider would say it: "road", not "segment", and the
 * gesture this machine actually has rather than both spelled out. The old
 * wording named the data model — appending connected segments is what the code
 * does, and nobody arrives here holding a graph.
 *
 * Amber is the site's colour for whatever is live, and on a screen with no ride
 * on it yet the only live thing is this. It is spent on the mark alone: the
 * sentence stays sand, which is legible at this size where amber on its own
 * tint is not, and the tinted band is what carries the eye.
 *
 * Built to wrap, because at any readable size it does: this sentence wants
 * 338px and the sidebar's text column is 256px, so one line would mean 11px
 * type — smaller than the steps under it, for the thing meant to be read
 * first. So the two lines are made to look chosen rather than survived.
 *
 * Balanced against each other, and then set large enough to fill what
 * balancing measures out. Those two go together: balancing alone splits the
 * sentence into two short lines and leaves the right half of the band empty,
 * which reads worse than the orphan it fixed. At this size both lines run most
 * of the width, so the band is full and the break looks deliberate. It is also
 * the size the only instruction on an empty screen deserves.
 */
function StartHere() {
  return (
    <p className="border-blaze/35 bg-blaze/10 text-sand flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[1.3125rem] leading-snug">
      {/* Nudged down onto the middle of the first line rather than the top of
          its box, so the mark sits on that line instead of floating above it. */}
      <PickIcon
        weight="bold"
        aria-hidden
        className="text-blaze mt-1 h-[1.375rem] w-[1.375rem] shrink-0"
      />
      <span className="text-balance">
        {PICK} any road on the map to start building your route.
      </span>
    </p>
  );
}

/**
 * The whole of how this works, in three lines.
 *
 * A rider who has never seen the site does not know that roads chain, that the
 * bright ones are the legal next moves, or that a ride can leave here as a
 * file — and none of that is discoverable from a map of lines. Three lines is
 * the budget: it is under the fold on a phone at rest, so it has to be worth
 * finding without being what anyone has to read before their first pick.
 *
 * It starts from the pick rather than repeating it, because the sentence
 * telling them to pick is already pinned above this and always in view.
 */
const STEPS = [
  "Select a segment and unreachable segments will dim",
  "Keep picking to add on to the route",
  "Save or export the ride",
];

function HowItWorks() {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow text-sand/70">How it works</h2>
      <ol className="flex flex-col gap-1.5">
        {STEPS.map((step, index) => (
          <li key={step} className="flex items-baseline gap-2.5">
            {/* Hidden from a reader who is already being told this is the
                second of three, and kept off the amber so the invitation above
                stays the one warm thing on an empty screen.

                Sat on its baseline rather than in its box: it is mono and a
                point smaller than the sentence beside it, and two line boxes
                of different heights share a top edge, not a baseline — which
                left the digit riding a pixel high. */}
            <span
              aria-hidden
              className="tabular text-sand/45 w-2 shrink-0 text-xs"
            >
              {index + 1}
            </span>
            <span className="text-sand/75 text-[0.8125rem] leading-relaxed">
              {step}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Keep this ride, and export it as a file.
 *
 * Both are the same act from a rider's side — "I want this later" — so they sit
 * together rather than being scattered around the panel.
 */
function SaveRide({
  route,
  points,
  meters,
  onSave,
}: {
  route: Route;
  points: ElevCoord[];
  meters: number;
  onSave: (name: string, route: string) => void;
}) {
  const [name, setName] = useState("");

  /** Enter and the button are the same act, so they are the same code. */
  function keep() {
    onSave(name, encodeRoute(route));
    setName("");
  }

  return (
    <div className="border-sand/10 flex gap-2 border-t pt-3">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") keep();
        }}
        placeholder="Name this ride"
        aria-label="Name this ride"
        className="border-sand/15 bg-forest-deep/40 text-sand placeholder:text-sand/70 focus:border-blaze/60 focus:ring-blaze min-h-11 min-w-0 flex-1 rounded-md border px-2 py-1.5 text-xs transition-colors focus:ring-2 focus:outline-none"
      />
      <Button variant="outline" className="px-2 text-xs" onClick={keep}>
        Save
      </Button>
      <Button
        variant="primary"
        className="px-2 text-xs"
        aria-label="Download as GPX"
        title="Download as GPX"
        onClick={() =>
          downloadGpx(points, name.trim() || `Seaddle ${formatMiles(meters)}`)
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
  // Held rather than acted on: a saved ride lives in this browser and nowhere
  // else, so the X asks before it is the end of one.
  const [forgetting, setForgetting] = useState<SavedRide | null>(null);

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
              onClick={() => setForgetting(ride)}
              aria-label={`Forget ${ride.name}`}
              className="text-sand/70 hover:text-blaze focus-visible:ring-blaze flex h-11 w-11 shrink-0 items-center justify-center rounded transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <X weight="bold" aria-hidden className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={forgetting !== null}
        onOpenChange={(open) => !open && setForgetting(null)}
        title="Forget this ride?"
        confirm="Forget"
        onConfirm={() => {
          if (forgetting) onForget(forgetting.id);
          setForgetting(null);
        }}
      >
        “{forgetting?.name}” is saved in this browser only, so forgetting it
        here is the end of it.
      </ConfirmDialog>
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
