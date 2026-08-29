import {
  ArrowUUpLeft,
  ArrowUUpRight,
  DownloadSimple,
  Trash,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { MOD, typingIn } from "@/lib/utilities/keys";
import { useUnits } from "@/lib/use-units";
import { Button } from "@/widgets/button";
import { ConfirmDialog } from "@/widgets/confirm-dialog";
import { ElevationProfile, type Scrub } from "@/widgets/elevation-profile";
import { SeaddleMark } from "@/widgets/seaddle-mark";
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
import {
  chosenName,
  routeNamed,
  useSavedRoutes,
  type SavedRoute,
} from "../use-saved-routes";
import { RouteBreakdown } from "./route-breakdown";
import { SavedRoutes } from "./saved-routes";
import { PICK } from "../pointing";
import { StartHere } from "./start-here";
import { TurningsList } from "./turnings-list";

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
  onScrub: (scrub: Scrub | null) => void;
  /** The segments that can be taken next, for picking without the map. */
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
  const saved = useSavedRoutes();
  const units = useUnits();
  // Every point of the route, and the reader drags along the chart: recomputing
  // it on each of those renders is walking the whole route per pointer move.
  const points = useMemo(() => routePoints(route, graph), [route, graph]);
  const meters = routeMeters(route, graph);
  const gain = routeGain(route, graph);
  const started = !isEmpty(route);
  const onward = started ? continuations(route, graph).size : 0;
  const stuck = started && onward === 0;
  const ridden = routeSegments(route, graph);

  // Held rather than acted on: a route is a long run of picks and there is one
  // button that throws all of them away at once. Redo can bring it back, but
  // nobody who has just watched their route vanish thinks to reach for Redo.
  const [clearing, setClearing] = useState(false);

  // ⌘⌫, which asks the same question the button does rather than clearing
  // outright — a single key is far too short a walk to an empty map. The
  // modifier is also what keeps this apart from the bare ⌫ that takes back one
  // segment: the same key throws away every segment, so it costs a thumb more.
  // Both spellings of the key, since the one labelled "delete" sends Backspace
  // on a laptop and Delete on a full keyboard. Bound beside the button so the
  // two cannot drift apart, and stood aside from while someone is naming a
  // route, where ⌘⌫ is a rubout. Listed in `SHORTCUTS` in the settings dialog:
  // bind a key here and name it there.
  useEffect(() => {
    if (!started) return;

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      if (typingIn(event.target)) return;

      event.preventDefault();
      setClearing(true);
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started]);

  /**
   * Nothing on first arrival — there is no news in a page having just loaded,
   * and a reader landing here is about to be read the panel anyway. An empty
   * route only has something to say once it got that way by being undone.
   */
  const announcement = !started
    ? canRedo
      ? "Route cleared."
      : ""
    : stuck
      ? `${units.distance(meters)}, ${units.climbRange(gain.min, gain.max)} of climbing. Nothing continues from here — pick any segment and the way there fills in.`
      : `${units.distance(meters)}, ${units.climbRange(gain.min, gain.max)} of climbing. ` +
        `${onward} ${onward === 1 ? "segment" : "segments"} on from here.`;

  return (
    <Sheet
      label="Your route"
      headerAt="desktop"
      // The map is the thing here, and the first pick is a change on the map:
      // rising to meet it would cover the very segment that was just chosen.
      // The panel stays low and the pinned slot carries the reading, so the
      // route is read where it is being drawn and the panel comes up when it is
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
         what a rider sees without touching anything. Before a route starts that
         should be how to start one: two zeros are not a reading, they are the
         absence of one, and they were holding the most visible place on the
         screen against the only sentence that had somewhere to send anybody. */
      peek={
        started ? (
          <div className="border-sand/10 flex items-end gap-6 border-t pt-3 max-md:border-t-0 max-md:pt-0">
            <Figure label="distance" value={units.distance(meters)} />
            <Figure
              label="climbing"
              value={units.climbRange(gain.min, gain.max)}
            />
          </div>
        ) : (
          <StartHere headline="Build your route">
            {PICK} any segment on the map to add it.
          </StartHere>
        )
      }
    >
      <div className="flex flex-col gap-5">
        {/* What just happened, for a reader who cannot see the map redraw.
            Picking a segment is a click on a canvas: nothing about it lands
            in the document, so without this the whole interaction is
            silent. */}
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
                This is as far as the map goes that way. Pick a segment anywhere
                and the way there fills in.
              </p>
            )}
          </>
        ) : (
          <HowBuildingWorks />
        )}

        {/* Lifted to the top of the scroll on a phone, where the panel rests
            low and everything below the fold costs a drag: taking a pick back
            is the move a rider makes most, so it is the one that should be in
            reach without one. The sidebar has no fold to be under, so there it
            stays where it reads — after the route it acts on.

            Still here once a route has been undone away to nothing, because
            that is exactly the moment Redo is the thing being reached for. */}
        {(started || canRedo) && (
          <div className="flex flex-wrap gap-2 max-md:order-first">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onUndo}
              disabled={!canUndo}
              title={`Undo (${MOD}Z or \u232b)`}
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
                onClick={() => setClearing(true)}
                title={`Start over (${MOD}\u232b)`}
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
          <SaveRoute
            route={route}
            points={points}
            meters={meters}
            saved={saved.routes}
            onSave={saved.save}
          />
        )}

        <SavedRoutes
          routes={saved.routes}
          graph={graph}
          current={encodeRoute(route)}
          onLoad={onLoad}
          onRename={saved.rename}
          onForget={saved.remove}
        />

        <ConfirmDialog
          open={clearing}
          onOpenChange={setClearing}
          title="Start over?"
          confirm="Start over"
          onConfirm={() => {
            setClearing(false);
            onClear();
          }}
        >
          You'll lose all the beautiful mapping you've done! Are you sure?
        </ConfirmDialog>
      </div>
    </Sheet>
  );
}

/**
 * The whole of how this works, in three lines.
 *
 * A rider who has never seen the site does not know that segments chain, that
 * a segment picked from across town brings the way there with it, or that a
 * route can leave here as a file — and none of that is discoverable from a map
 * of lines. Three lines is the budget: it is under the fold on a phone at rest,
 * so it has to be worth finding without being what anyone has to read before
 * their first pick.
 *
 * It starts from the pick rather than repeating it, because the sentence
 * telling them to pick is already pinned above this and always in view.
 */
const STEPS = [
  "Pick any segment — the way there fills itself in",
  "Keep picking to add on to the route",
  "Save or export the route",
];

function HowBuildingWorks() {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow text-sand/70">Build mode</h2>
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
 * Keep this route, and export it as a file.
 *
 * Both are the same act from a rider's side — "I want this later" — so they sit
 * together rather than being scattered around the panel.
 */
function SaveRoute({
  route,
  points,
  meters,
  saved,
  onSave,
}: {
  route: Route;
  points: ElevCoord[];
  meters: number;
  /** What is already kept, to see whether this name is spoken for. */
  saved: SavedRoute[];
  onSave: (name: string, route: string) => void;
}) {
  const [name, setName] = useState("");
  // Held rather than acted on: the list is read by name, so a second route
  // under a name already in it would have to push the first one out — and
  // nobody types a name expecting to lose the route that had it.
  const [replacing, setReplacing] = useState(false);
  const { distance } = useUnits();

  const encoded = encodeRoute(route);
  const clash = routeNamed(saved, chosenName(name));
  // Saving this same route again under its own name is the rename the list
  // already does, not an overwrite, so it is not worth a question.
  const overwrites = clash && clash.route !== encoded ? clash : null;

  /** Enter and the button are the same act, so they are the same code. */
  function keep() {
    if (overwrites) {
      setReplacing(true);
      return;
    }
    commit();
  }

  function commit() {
    onSave(name, encoded);
    setName("");
    setReplacing(false);
  }

  return (
    <div className="border-sand/10 flex gap-2 border-t pt-3">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") keep();
        }}
        placeholder="Name this route"
        aria-label="Name this route"
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
          downloadGpx(points, name.trim() || `Seaddle ${distance(meters)}`)
        }
      >
        <DownloadSimple weight="bold" className="h-4 w-4" />
        GPX
      </Button>

      <ConfirmDialog
        open={replacing}
        onOpenChange={setReplacing}
        title="Replace that route?"
        confirm="Replace"
        onConfirm={commit}
      >
        “{overwrites?.name}” is already saved under that name. Saving this route
        as “{chosenName(name)}” takes the name and forgets the route that had
        it.
      </ConfirmDialog>
    </div>
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
