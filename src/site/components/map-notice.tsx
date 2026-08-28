import { useEffect } from "react";
import { PEEK_VH } from "@/widgets/sheet";
import type { ClosedNotice } from "../why-closed";

/**
 * How long the message stays up.
 *
 * Long enough to read two lines twice, because the reader is a beginner who
 * has just been told a rule they did not know existed. It goes by itself
 * rather than waiting to be dismissed — a rider who has understood it should
 * not have to close anything before carrying on tapping roads.
 */
const LINGER_MS = 6000;

/**
 * A message, plus when it arrived.
 *
 * The stamp is what makes the same refusal twice read as twice: without it the
 * second tap on the same dead road changes no text, replays no animation, and
 * looks exactly like a tap that did nothing at all — which is the thing this
 * whole message exists to stop happening.
 */
export type Notice = ClosedNotice & { at: number };

/**
 * Why the road you just tapped did nothing.
 *
 * Over the map rather than in a dialog: the answer is about the lines
 * underneath it — which ones are bright, which end of the ride they leave from
 * — and a modal would cover the very thing it was describing while demanding
 * a click to get out of the way.
 *
 * `pointer-events-none`, for the same reason the watermark has it: this is a
 * label, and the road under it is the interface. A rider who reads it and
 * immediately taps the right road must not be blocked by the sentence that
 * told them which one it was.
 */
export function MapNotice({
  notice,
  onDone,
}: {
  notice: Notice | null;
  onDone: () => void;
}) {
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(onDone, LINGER_MS);
    return () => clearTimeout(timer);
  }, [notice, onDone]);

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
        <div
          key={notice.at}
          className="rise border-forest-lift/40 bg-forest-deep/95 text-sand rounded-lg border px-3.5 py-2.5 shadow-[0_4px_20px_rgba(18,48,31,0.35)] backdrop-blur-[2px]"
        >
          <p className="eyebrow text-blaze mb-1">{notice.headline}</p>
          <p className="text-[0.8125rem] leading-snug text-balance">
            {notice.detail}
          </p>
        </div>
      )}
    </div>
  );
}
