import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utilities/style-utils";

export type Detent = "peek" | "half" | "full";

/**
 * The resting height the sheet spends most of its time at.
 *
 * Sized to clear the pinned header — the counts and the mode switch — because
 * a resting height that cuts the mode switch in half would make the control
 * you need most the one you have to drag for. Exported because anything laid
 * over the map has to sit clear of it.
 */
export const PEEK_VH = 22;

/** How much of the viewport the sheet shows at each resting height. */
const DETENT_VH: Record<Detent, number> = { peek: PEEK_VH, half: 52, full: 88 };
const ORDER: Detent[] = ["peek", "half", "full"];

/**
 * How far a thumb may travel and still have meant a tap, in pixels.
 *
 * A finger never lands and lifts on exactly one pixel, so without a margin
 * every tap would register as a one-pixel drag, snap back to the height it
 * started at, and look like nothing happened.
 */
const TAP_SLOP = 8;

/**
 * The width at which the sheet becomes a static sidebar, matching the
 * breakpoint `.sheet` is written against in the stylesheet.
 *
 * The header is a drag surface only below it: on a wide screen there is
 * nothing to drag, and a title that swallows a mouse drag is just a title you
 * cannot select.
 */
const SIDEBAR_WIDTH = "(min-width: 48rem)";

type SheetProps = {
  /**
   * The panel's identity — mark, name, what it is for.
   *
   * Kept apart from `peek` because on a phone it doubles as drag surface: a
   * grab bar alone is a small target for a thumb, and the block above the
   * first control is the one place nothing is lost by dragging from it.
   */
  header?: ReactNode;
  /**
   * Pinned above the scrolling area and visible at every resting height.
   * Whatever decides the meaning of what is below it belongs here.
   */
  peek: ReactNode;
  /**
   * Raise the sheet when this becomes true, and lower it when it stops.
   *
   * Candidates arriving below the fold is the same as them not arriving, so
   * the panel comes up to meet them rather than waiting to be dragged.
   */
  raisedWhen?: boolean;
  /**
   * How far up it goes, and where it sits otherwise.
   *
   * Different for a panel being worked in and one being glanced at: the admin
   * wants candidates fully in view, while the site is a map first — throwing
   * the panel over most of it the instant a segment is picked hides the very
   * change the pick just made.
   */
  raisedTo?: Detent;
  restingAt?: Detent;
  /**
   * Drop the sheet out of the way whenever this changes.
   *
   * For the moments the answer is on the map rather than in the panel — asking
   * to be shown where something is, only for the panel to be covering it.
   */
  lowerOn?: unknown;
  /**
   * What this panel is, for a reader moving between landmarks.
   *
   * The heading inside it names the site rather than the panel, so without
   * this the one region holding every control is announced as "complementary"
   * and nothing else.
   */
  label?: string;
  /**
   * Where the header block is shown.
   *
   * "desktop" hands the phone's top corner to whatever is behind the sheet —
   * the site's map carries the mark there instead, and the sheet keeps the room
   * for what changes. It has to be decided here rather than by hiding the
   * caller's own node, because the padding around the slot is the sheet's.
   */
  headerAt?: "all" | "desktop";
  children: ReactNode;
};

/**
 * A sidebar on a wide screen, a dragged bottom sheet on a phone.
 *
 * On a phone the map is the interface, so the panel cannot take the screen:
 * it rests over the bottom edge and is pulled up as far as it is needed. Three
 * resting heights rather than free movement, because a panel that stops
 * wherever your thumb left it never looks deliberate.
 */
export function Sheet({
  header,
  peek,
  raisedWhen = false,
  raisedTo = "full",
  restingAt = "half",
  lowerOn,
  label,
  headerAt = "all",
  children,
}: SheetProps) {
  const [detent, setDetent] = useState<Detent>(restingAt);
  const [dragVh, setDragVh] = useState<number | null>(null);
  /**
   * How tall the pinned part actually is, so `peek` can never cut it off.
   *
   * The resting heights are fractions of the viewport and the thing they have
   * to clear is measured in pixels, which are two different scales: 22% of a
   * tall phone is a comfortable strip and 22% of a short one is 147px, and the
   * segment being read needs about 190. So the panel's lowest height is a floor
   * under the vh rather than the vh itself — whichever is taller wins. Nothing
   * up here decides what is worth showing; the pinned slot is by definition the
   * part that is always visible, and this is what keeps that promise on a
   * screen the fraction was never checked against.
   */
  const pinned = useRef<HTMLDivElement>(null);
  const [floorPx, setFloorPx] = useState(0);
  const drag = useRef<{
    startY: number;
    startVh: number;
    /** The furthest from the start this gesture has been, in pixels. */
    moved: number;
  } | null>(null);

  const visibleVh = dragVh ?? DETENT_VH[detent];
  /**
   * Whether the panel is down at its lowest, exposed for the content to answer.
   *
   * Nothing tall is worth the few lines showing at `peek` — a chart cut off at
   * its first inch is not a smaller chart, it is a strip of ink under whatever
   * the rider actually came for. Read from the live height rather than the
   * detent so what it hides comes back as the drag passes `peek` instead of
   * waiting for the thumb to lift.
   *
   * On a wide screen the sidebar is a fixed height and the detent it happens
   * to be holding means nothing, so anything keying off this belongs behind a
   * `max-md:`.
   */
  const collapsed = visibleVh <= PEEK_VH;

  // Watched rather than measured once: the pinned slot holds whatever segment
  // was last tapped, and a name that wraps to two lines is a taller floor than
  // the one before it.
  useEffect(() => {
    const node = pinned.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setFloorPx(node.offsetHeight));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setDetent(raisedWhen ? raisedTo : restingAt);
  }, [raisedWhen, raisedTo, restingAt]);

  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setDetent("peek");
  }, [lowerOn]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (window.matchMedia(SIDEBAR_WIDTH).matches) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = {
        startY: event.clientY,
        startVh: DETENT_VH[detent],
        moved: 0,
      };
    },
    [detent],
  );

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!drag.current) return;
    drag.current.moved = Math.max(
      drag.current.moved,
      Math.abs(event.clientY - drag.current.startY),
    );
    // Below the slop the panel does not move at all, so a tap never leaves the
    // height it started at looking nudged before it settles back.
    if (drag.current.moved < TAP_SLOP) return;

    const moved =
      ((drag.current.startY - event.clientY) / window.innerHeight) * 100;
    // Never past the outer resting heights: a drag that could leave the panel
    // taller than `full` or shorter than `peek` would only snap back.
    setDragVh(
      Math.min(
        DETENT_VH.full,
        Math.max(DETENT_VH.peek, drag.current.startVh + moved),
      ),
    );
  }, []);

  /**
   * The end of a gesture, which is either a drag or a tap.
   *
   * Which one is decided by how far the thumb went, not by how long it was
   * down: a slow, deliberate press that never moves is still someone asking
   * for the panel, and a flick that covers half the screen in 80ms is still a
   * drag. `onTap` is passed only where a tap means something — a cancelled
   * gesture is not a tap, and neither is one on a surface that only drags.
   */
  const endGesture = useCallback(
    (onTap?: () => void) => {
      const gesture = drag.current;
      if (!gesture) return;
      const settled = dragVh;
      drag.current = null;
      setDragVh(null);

      if (gesture.moved < TAP_SLOP) {
        onTap?.();
        return;
      }
      if (settled === null) return;
      // Snap to whichever resting height the drag ended nearest.
      const nearest = ORDER.reduce((best, option) =>
        Math.abs(DETENT_VH[option] - settled) <
        Math.abs(DETENT_VH[best] - settled)
          ? option
          : best,
      );
      setDetent(nearest);
    },
    [dragVh],
  );

  /**
   * All the way up, or all the way down.
   *
   * Dragging is how you ask for a height in between; a tap is for the two
   * answers worth reaching in one gesture, and from anywhere short of the top
   * the one being asked for is the top.
   */
  const toggle = useCallback(() => {
    setDetent((current) => (current === "full" ? "peek" : "full"));
  }, []);

  /** Drag only — the header, where a tap would fire on the title. */
  const dragHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp: () => endGesture(),
    onPointerCancel: () => endGesture(),
  };

  /** Drag or tap — the bar, which is nothing but a handle. */
  const handleHandlers = {
    ...dragHandlers,
    onPointerUp: () => endGesture(toggle),
  };

  const step = useCallback((direction: 1 | -1) => {
    setDetent((current) => {
      const next = ORDER.indexOf(current) + direction;
      return ORDER[Math.min(ORDER.length - 1, Math.max(0, next))];
    });
  }, []);

  return (
    <aside
      aria-label={label}
      data-collapsed={collapsed || undefined}
      className={cn(
        "group/sheet sheet bg-forest text-sand fixed inset-x-0 bottom-0 z-30 flex flex-col rounded-t-2xl",
        "shadow-[0_-8px_32px_rgba(18,48,31,0.28)]",
        "md:static md:w-[22rem] md:rounded-none md:shadow-none lg:w-96",
        // Only between resting heights. Under the thumb it tracks the drag
        // directly, and a transition there would lag behind it.
        dragVh === null &&
          "transition-[height] duration-300 ease-[var(--ease-settle)]",
      )}
      style={
        {
          "--sheet-visible": visibleVh,
          "--sheet-floor": `${floorPx}px`,
        } as React.CSSProperties
      }
    >
      {/* The handle, the header and the pinned slot in one box, because their
          combined height is the floor above — and a floor measured off three
          separate elements is three numbers to keep in step. */}
      <div ref={pinned} className="shrink-0">
        {/* The bar is four pixels of it and the rest is padding, because what has
          to be 44px is the thing a thumb aims at, not the thing it can see. */}
        <div
          role="separator"
          aria-label="Resize panel"
          aria-orientation="horizontal"
          tabIndex={0}
          {...handleHandlers}
          onKeyDown={(event) => {
            if (event.key === "ArrowUp") step(1);
            else if (event.key === "ArrowDown") step(-1);
            // The same shortcut the tap is: the keyboard should not be the one
            // input that has to ask for the top a step at a time.
            else if (event.key === "Enter" || event.key === " ") toggle();
            else return;
            event.preventDefault();
          }}
          className="group flex cursor-grab touch-none justify-center py-5 outline-none active:cursor-grabbing md:hidden"
        >
          {/* The ring goes on the bar, not on the 44px box around it — the box is
            the full width of the panel, and a ring on that reads as two rules
            across the panel rather than as a control being focused. */}
          <span className="bg-sand/30 group-active:bg-sand/60 group-focus-visible:ring-blaze h-1 w-10 rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-offset-4 group-focus-visible:ring-offset-[var(--color-forest)]" />
        </div>

        {/* Draggable alongside the grab bar rather than instead of it: the bar
          says the panel moves, and the block under it gives a thumb somewhere
          big enough to say so to. The keyboard control stays on the bar, which
          is the part that is only a handle. */}
        {header && (
          <div
            {...dragHandlers}
            className={cn(
              "shrink-0 px-5 pb-4 max-md:cursor-grab max-md:touch-none max-md:select-none max-md:active:cursor-grabbing md:pt-5",
              headerAt === "desktop" && "max-md:hidden",
            )}
          >
            {header}
          </div>
        )}

        <div className={cn("px-5 pb-3", !header && "md:pt-5")}>{peek}</div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
        {children}
      </div>
    </aside>
  );
}
