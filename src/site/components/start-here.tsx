import { CursorClick, HandTap } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { POINTING } from "../pointing";

/** The mark for the gesture this machine has, beside the word for it. */
const PickIcon = POINTING ? CursorClick : HandTap;

/**
 * The invitation to begin, in the panel's pinned slot.
 *
 * Said the way a first-time rider would say it: "road", not "segment", and the
 * gesture this machine actually has rather than both spelled out. The old
 * wording named the data model — appending connected segments is what the code
 * does, and nobody arrives here holding a graph.
 *
 * Amber is the site's colour for whatever is live, and on a screen with nothing
 * chosen on it yet the only live thing is this. It is spent on the mark alone:
 * the sentence stays sand, which is legible at this size where amber on its own
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
 *
 * Both modes open on an empty panel, so both say what to do with it — the
 * sentence differs, everything holding it does not.
 */
export function StartHere({ children }: { children: ReactNode }) {
  return (
    <p className="border-blaze/35 bg-blaze/10 text-sand flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-[1.3125rem] leading-snug">
      {/* Nudged down onto the middle of the first line rather than the top of
          its box, so the mark sits on that line instead of floating above it. */}
      <PickIcon
        weight="bold"
        aria-hidden
        className="text-blaze mt-1 h-[1.375rem] w-[1.375rem] shrink-0"
      />
      <span className="text-balance">{children}</span>
    </p>
  );
}
