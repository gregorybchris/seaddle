import { X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utilities/style-utils";
import { PEEK_VH } from "@/widgets/sheet";

/**
 * How long a message stays up when it does not say.
 *
 * Long enough to read two lines twice, because the reader is a beginner who
 * has just been told a rule they did not know existed. It goes by itself
 * rather than waiting to be dismissed — a rider who has understood it should
 * not have to close anything before carrying on tapping roads.
 *
 * A message confirming something the reader did on purpose does not need that
 * long, and outstays its welcome at it — flipping modes twice should not mean
 * twelve seconds of banner. Those set their own.
 */
const LINGER_MS = 6000;

/**
 * How far a thumb may travel and still have meant a tap, and how far it has to
 * travel to have meant a swipe.
 *
 * The same slop the sheet uses, for the same reason: a finger never lands and
 * lifts on one pixel, so without a margin every tap is a one-pixel drag. The
 * gap between the two is what stops a brush against the card from throwing it
 * away and a deliberate flick from being read as a tap.
 */
const TAP_SLOP = 8;
const SWIPE_PX = 64;

/**
 * A message, plus when it arrived.
 *
 * The stamp is what makes the same refusal twice read as twice: without it the
 * second tap on the same dead road changes no text, replays no animation, and
 * looks exactly like a tap that did nothing at all — which is the thing this
 * whole message exists to stop happening.
 */
export type Notice = {
  headline: string;
  detail: string;
  at: number;
  /** How long this one stays, where the default is wrong for it. */
  linger?: number;
};

/**
 * Whatever the map has to say about what just happened.
 *
 * Two kinds so far: why the road you tapped did nothing, and which mode you
 * have just switched into. Both belong here rather than in a dialog, because
 * both are about the lines underneath — which ones are bright, which end of
 * the ride they leave from, what a click on one now does — and a modal would
 * cover the very thing it was describing while demanding a click to get out of
 * the way.
 *
 * It can be put away early: an X to click, a swipe either way to throw it off,
 * or a tap anywhere on it. Everything around the card stays transparent to the
 * map, but the card itself no longer can be — a thing you can swipe is a thing
 * that has to receive the swipe. That is what the tap is for: while the card
 * is up it is in the way of the road under it, and a tap that did nothing at
 * all would read as the map having stopped working, where one that clears the
 * message leaves the road a second tap away.
 */
export function MapNotice({
  notice,
  onDone,
}: {
  notice: Notice | null;
  onDone: () => void;
}) {
  /** How far the card has been dragged from where it sits, in pixels. */
  const [shift, setShift] = useState(0);
  const [dragging, setDragging] = useState(false);
  /**
   * Where the gesture started, how far it has been from there at its furthest,
   * and where it is now.
   *
   * The last of those is also in state, for drawing — but it is read back from
   * here when the finger lifts, because a pointermove and the pointerup after
   * it can land in one batch and leave the rendered value a frame behind the
   * one the reader actually finished on.
   */
  const gesture = useRef<{ x: number; moved: number; dx: number } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(onDone, notice.linger ?? LINGER_MS);
    return () => clearTimeout(timer);
  }, [notice, onDone]);

  // A new message arrives where the last one sat, not where it was thrown to.
  useEffect(() => setShift(0), [notice]);

  /**
   * The end of a gesture, which is either a tap, a swipe, or neither.
   *
   * A cancelled gesture is none of the three — the pointer was taken away
   * rather than lifted, and throwing the message out on that would mean losing
   * it to a notification sliding down over the thumb holding it.
   */
  function end(lifted: boolean) {
    const finished = gesture.current;
    gesture.current = null;
    setDragging(false);
    setShift(0);
    if (!finished || !lifted) return;
    // A tap, or a swipe that went far enough. Anything in between springs
    // back, so a card nudged while reaching past it is still there to read.
    if (finished.moved < TAP_SLOP || Math.abs(finished.dx) > SWIPE_PX) onDone();
  }

  return (
    // Always mounted, so a reader on a screen reader gets the message
    // announced rather than getting a live region that only appears at the
    // same moment it has something to say — which is too late to be watched.
    <div
      role="status"
      aria-live="polite"
      style={{ "--peek-vh": PEEK_VH } as React.CSSProperties}
      className="map-notice pointer-events-none absolute left-1/2 z-20 w-[min(21rem,calc(100%-1.5rem))] -translate-x-1/2"
    >
      {notice && (
        // The card is dragged from here so that `rise` keeps the transform it
        // animates in on. Two transforms, two elements: an inline one on the
        // animated node would be overridden by the animation's own fill.
        <div
          key={notice.at}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            gesture.current = { x: event.clientX, moved: 0, dx: 0 };
            setDragging(true);
          }}
          onPointerMove={(event) => {
            if (!gesture.current) return;
            const dx = event.clientX - gesture.current.x;
            gesture.current.dx = dx;
            gesture.current.moved = Math.max(
              gesture.current.moved,
              Math.abs(dx),
            );
            if (gesture.current.moved < TAP_SLOP) return;
            setShift(dx);
          }}
          onPointerUp={() => end(true)}
          onPointerCancel={() => end(false)}
          style={{
            transform: `translateX(${shift}px)`,
            // Thinning as it goes, so a swipe looks like it is working before
            // it has gone far enough to count.
            opacity: 1 - Math.min(Math.abs(shift) / (SWIPE_PX * 3), 0.55),
          }}
          className={cn(
            "pointer-events-auto touch-none",
            // Only on the way back. Under the thumb it tracks the drag, and a
            // transition there would lag behind it.
            !dragging &&
              "transition-[transform,opacity] duration-200 ease-[var(--ease-settle)]",
          )}
        >
          <div className="rise border-forest-lift/40 bg-forest-deep/95 text-sand relative rounded-lg border py-2.5 pr-11 pl-3.5 shadow-[0_4px_20px_rgba(18,48,31,0.35)] backdrop-blur-[2px]">
            <p className="eyebrow text-blaze mb-1">{notice.headline}</p>
            <p className="text-[0.8125rem] leading-snug text-balance">
              {notice.detail}
            </p>
            {/* Named rather than left as an icon, because the message it closes
                is the only thing a reader has to go on for what it does. It
                swallows the gesture underneath it: the card would take a tap on
                the X as a tap on itself and call this twice. */}
            <button
              type="button"
              aria-label="Dismiss"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onDone}
              className="text-sand/60 hover:text-sand focus-visible:ring-blaze absolute top-1/2 right-1 grid h-9 w-9 -translate-y-1/2 place-items-center rounded transition-colors focus-visible:ring-2 focus-visible:outline-none"
            >
              <X weight="bold" aria-hidden className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
