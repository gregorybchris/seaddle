import { Check, PencilSimple, Trash, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utilities/style-utils";
import { useUnits } from "@/lib/use-units";
import { ConfirmDialog } from "@/widgets/confirm-dialog";
import { InfoPopover } from "@/widgets/info-popover";
import type { SiteGraph } from "../graph-data";
import { decodeRoute, isEmpty, routeGain, routeMeters } from "../route";
import { routeNamed, type SavedRoute } from "../use-saved-routes";

/**
 * What a saved route turns out to be, once it is read against the graph.
 *
 * Worked out here rather than written down beside the name, because a saved
 * route is a list of decisions and nothing else: the segments it names get
 * recut, so a distance stored last month would go on being shown long after it
 * stopped being true. Null once the graph has none of the segments left, which
 * is the one thing the row cannot show numbers for.
 */
type Reading = {
  meters: number;
  gain: { min: number; max: number };
} | null;

function read(encoded: string, graph: SiteGraph): Reading {
  const route = decodeRoute(encoded, graph);
  if (isEmpty(route)) return null;
  return { meters: routeMeters(route, graph), gain: routeGain(route, graph) };
}

type SavedRoutesProps = {
  routes: SavedRoute[];
  graph: SiteGraph;
  /** The route currently on the map, as a link spells it. */
  current: string;
  onLoad: (encoded: string) => void;
  onRename: (id: string, name: string) => void;
  onForget: (id: string) => void;
};

/**
 * Routes kept in this browser, newest first.
 *
 * Each one reads as a card rather than a line of text, because a name on its
 * own is not enough to choose between two routes saved a week apart — "Sunday"
 * and "Sunday again" are told apart by being nine miles and twenty-two. So the
 * numbers the panel shows for the route on the map are the numbers each saved
 * row carries too, in the same order, so the two can be compared by eye.
 */
export function SavedRoutes({
  routes,
  graph,
  current,
  onLoad,
  onRename,
  onForget,
}: SavedRoutesProps) {
  // Every saved route walked against the graph, which is a walk per route per
  // render otherwise — and this panel re-renders on every pick.
  const readings = useMemo(
    () => new Map(routes.map((saved) => [saved.id, read(saved.route, graph)])),
    [routes, graph],
  );

  // Held rather than acted on: a saved route lives in this browser and nowhere
  // else, so the bin asks before it is the end of one.
  const [forgetting, setForgetting] = useState<SavedRoute | null>(null);

  if (routes.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow text-sand/70 flex items-center gap-1.5">
        Your routes
        <InfoPopover label="About saved routes">
          Routes are saved only on your device. Clearing your browser data will
          delete them permanently. Download a route as GPX if you want to keep
          it.
        </InfoPopover>
      </h2>

      <ul className="flex flex-col gap-1.5">
        {routes.map((saved) => (
          <Row
            key={saved.id}
            saved={saved}
            reading={readings.get(saved.id) ?? null}
            onMap={saved.route === current}
            clashFor={(name) => routeNamed(routes, name, saved.id)}
            onLoad={() => onLoad(saved.route)}
            onRename={(name) => onRename(saved.id, name)}
            onForget={() => setForgetting(saved)}
          />
        ))}
      </ul>

      <ConfirmDialog
        open={forgetting !== null}
        onOpenChange={(open) => !open && setForgetting(null)}
        title="Forget this route?"
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

function Row({
  saved,
  reading,
  onMap,
  clashFor,
  onLoad,
  onRename,
  onForget,
}: {
  saved: SavedRoute;
  reading: Reading;
  /** This is the route currently drawn, so loading it would change nothing. */
  onMap: boolean;
  /** The other saved route this name would take, if it would take one. */
  clashFor: (name: string) => SavedRoute | undefined;
  onLoad: () => void;
  onRename: (name: string) => void;
  onForget: () => void;
}) {
  const { distance, climbRange } = useUnits();
  // The name as it is being typed over, and null while it is not being typed
  // over at all. One piece of state rather than a flag beside a draft, which
  // are two things that can disagree about whether a rename is happening — and
  // it lives up here rather than in the field, because the tick that commits it
  // is not inside the field.
  const [draft, setDraft] = useState<string | null>(null);
  // A name that is spoken for, waiting on an answer about whose it is. The
  // field stays open behind the question: cancelling leaves what was typed
  // where it was typed, so the answer to "not that one" is to edit it rather
  // than to start again.
  const [taking, setTaking] = useState<string | null>(null);
  const taken = taking === null ? undefined : clashFor(taking);

  /** Enter, the tick, and the caret leaving the field are all the same act. */
  function commit() {
    if (draft === null) return;
    if (clashFor(draft)) {
      setTaking(draft);
      return;
    }
    onRename(draft);
    setDraft(null);
  }

  const measurements = reading
    ? [
        distance(reading.meters),
        `${climbRange(reading.gain.min, reading.gain.max)} of climbing`,
      ]
    : ["no longer on the map"];

  return (
    <li
      className={cn(
        "group flex items-stretch gap-1 rounded-lg border pr-0.5 transition-colors",
        onMap
          ? "border-blaze/50 bg-blaze/10"
          : "border-sand/15 bg-forest-lift/20 hover:border-sand/40 hover:bg-forest-lift/50",
      )}
    >
      {/* The whole card loads the route, numbers and all — a row that reads as
          one thing should not turn out to be a name that is clickable sitting
          above a line that is not. Only the two buttons at the end are their
          own targets. */}
      {draft === null ? (
        <button
          type="button"
          onClick={onLoad}
          aria-current={onMap ? "true" : undefined}
          // The row is read as one sentence rather than as a name and a string
          // of abbreviations: "12.4 mi" is a distance out loud only if
          // something says so.
          aria-label={[saved.name, ...measurements].join(", ")}
          className={cn(
            "focus-visible:ring-blaze flex min-w-0 flex-1 flex-col",
            "justify-center gap-0.5 rounded-lg py-1.5 pl-2.5 text-left",
            "transition-colors focus-visible:ring-2 focus-visible:outline-none",
            // Carried by the button rather than by the card, so the name
            // brightens for the thing that will actually load the route and
            // not for a cursor on its way to the bin.
            onMap ? "text-blaze" : "text-sand hover:text-blaze",
          )}
        >
          <span aria-hidden className="w-full min-w-0 truncate text-sm">
            {saved.name}
          </span>
          <Measurements reading={reading} />
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 py-1.5 pl-2.5">
          <RenameField
            name={saved.name}
            draft={draft}
            onDraft={setDraft}
            onCommit={commit}
            onCancel={() => setDraft(null)}
          />
          {/* Kept in view while the name is being typed over, so a rider
              renaming the shorter of two routes can still see which one that
              is. */}
          <Measurements reading={reading} />
        </div>
      )}

      {/* One cluster rather than two loose buttons: the pair belongs to the
          row's edge, and the only gap that should be visible is the one between
          them and the name. Both slots also stay put between the two states, so
          committing a rename does not shuffle the buttons under the finger
          that is about to hit one. */}
      <div
        className={cn(
          "flex shrink-0 items-stretch transition-opacity",
          // Out of the way until the row is being dealt with: two icons on
          // every row is a column of chrome down the panel, and neither is what
          // a saved route is for. They keep their space rather than being taken
          // out of the layout, so nothing shifts under the cursor arriving.
          "opacity-0 group-hover:opacity-100",
          // A keyboard has no hover, and neither does a finger: focus anywhere
          // in the row brings them back — which covers the rename field too —
          // and a touch screen never hides them in the first place.
          "group-focus-within:opacity-100 pointer-coarse:opacity-100",
        )}
      >
        {draft !== null ? (
          <>
            {/* Neither of these may take focus off the field, which is what
                `holdFocus` is for: leaving the field commits and closes the pair,
                so a click that blurred on the way down would land on whichever
                button had moved into that spot — the tick would press the pencil
                and reopen the rename it had just finished.

                Keyed so React swaps the buttons rather than reusing the same two
                elements with new labels, which would leave a keyboard on the tick
                after it had turned into the pencil. */}
            <RowButton
              key="rename-done"
              label={`Save the name for ${saved.name}`}
              holdFocus
              onClick={commit}
              icon={<Check weight="bold" className="h-4 w-4" />}
            />
            <RowButton
              key="rename-cancel"
              label={`Stop renaming ${saved.name}`}
              holdFocus
              onClick={() => setDraft(null)}
              icon={<X weight="bold" className="h-4 w-4" />}
            />
          </>
        ) : (
          <>
            <RowButton
              key="rename"
              label={`Rename ${saved.name}`}
              onClick={() => setDraft(saved.name)}
              icon={<PencilSimple weight="bold" className="h-4 w-4" />}
            />
            <RowButton
              key="forget"
              label={`Forget ${saved.name}`}
              onClick={onForget}
              icon={<Trash weight="bold" className="h-4 w-4" />}
            />
          </>
        )}
      </div>

      <ConfirmDialog
        open={taking !== null}
        onOpenChange={(open) => !open && setTaking(null)}
        title="Replace that route?"
        confirm="Replace"
        onConfirm={() => {
          if (taking !== null) onRename(taking);
          setTaking(null);
          setDraft(null);
        }}
      >
        “{taken?.name}” is already saved under that name. Renaming this one to “
        {taking}” takes the name and forgets the route that had it.
      </ConfirmDialog>
    </li>
  );
}

/** What the route comes to, in the order the panel above reads them. */
function Measurements({ reading }: { reading: Reading }) {
  const { distance, climbRange } = useUnits();

  return (
    <span
      aria-hidden
      className="tabular text-sand/70 w-full truncate text-[0.6875rem] leading-tight"
    >
      {reading ? (
        <>
          <span className="text-sand">{distance(reading.meters)}</span>
          {" · "}
          <span className="text-sand mr-0.5">&uarr;</span>
          {climbRange(reading.gain.min, reading.gain.max)}
        </>
      ) : (
        // A link outlives the segments it was cut from, and `decodeRoute` drops
        // what the graph no longer has. Saying so beats a row of zeros that
        // reads as a route with no length.
        <span className="text-sand/60">No longer on the map</span>
      )}
    </span>
  );
}

/**
 * The two small acts a saved route offers, drawn the same size as each other.
 *
 * Always visible rather than appearing on hover: there is no hover on a phone,
 * and a control that only exists for a mouse is a control half the riders here
 * do not have.
 */
function RowButton({
  label,
  icon,
  onClick,
  holdFocus = false,
}: {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  /** Leave the caret where it is when this is pressed. */
  holdFocus?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseDown={holdFocus ? (event) => event.preventDefault() : undefined}
      aria-label={label}
      title={label}
      className={cn(
        // Narrow, because two of these sit at the end of a row in a panel that
        // is a phone wide — and they can be: each one stretches the whole
        // height of the row, so what a thumb lands on is taller than it is
        // wide rather than small.
        "text-sand/60 hover:text-blaze focus-visible:ring-blaze flex w-7 shrink-0",
        "items-center justify-center rounded transition-colors",
        "focus-visible:ring-2 focus-visible:outline-none",
      )}
    >
      {icon}
    </button>
  );
}

/**
 * The name, while it is being changed.
 *
 * Typing in place rather than in a dialog: a rename is a few characters, and
 * the row it sits in is the only thing that makes it obvious which route is
 * being renamed. Enter and the caret leaving the field are the same act — that
 * is how the admin's rows already behave — and Escape puts the old name back.
 */
function RenameField({
  name,
  draft,
  onDraft,
  onCommit,
  onCancel,
}: {
  /** The name as it stands, for what this is announced as. */
  name: string;
  draft: string;
  onDraft: (draft: string) => void;
  onCommit: () => void;
  onCancel: () => void;
}) {
  const field = useRef<HTMLInputElement>(null);

  // Selected, not merely focused: this is opened in order to replace a name,
  // and a caret parked at the end means backspacing through it first.
  useEffect(() => field.current?.select(), []);

  return (
    <input
      ref={field}
      value={draft}
      onChange={(event) => onDraft(event.target.value)}
      onBlur={onCommit}
      onKeyDown={(event) => {
        if (event.key === "Enter") onCommit();
        if (event.key === "Escape") onCancel();
      }}
      aria-label={`Rename ${name}`}
      className={cn(
        "border-sand/25 bg-forest-deep/50 text-sand focus:border-blaze/60",
        "focus:ring-blaze -mx-1 min-w-0 rounded border px-1 text-sm",
        "focus:ring-1 focus:outline-none",
      )}
    />
  );
}
