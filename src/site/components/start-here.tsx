import { CursorClick, HandTap } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { POINTING } from "../pointing";

/** The mark for the gesture this machine has, beside the word for it. */
const PickIcon = POINTING ? CursorClick : HandTap;

/**
 * The invitation to begin, in the panel's pinned slot.
 *
 * Two lines rather than one long one, because a call to action and the gesture
 * that answers it are two different things: the first names what the reader is
 * about to get, the second says which finger to move. Set one sentence deep and
 * they compete — the whole block has to be read before either lands.
 *
 * Neither line is large. The old one was set at 21px so a single sentence would
 * fill its band, which made the quietest screen on the site the loudest thing on
 * it. Hierarchy carries the emphasis instead: the headline sits a step above the
 * body text and the detail a step below it, which is enough to be read first at
 * a size that still belongs to the panel around it.
 *
 * Amber is the site's colour for whatever is live, and on a screen with nothing
 * chosen yet the only live thing is this. It is spent in three weakening
 * layers — the disc, the tint, the hairline — so the block reads as warm rather
 * than as a warning. The sentences stay sand, which is legible at this size
 * where amber on its own tint is not.
 *
 * Both modes open on an empty panel, so both say what to do with it — the words
 * differ, everything holding them does not.
 */
export function StartHere({
  headline,
  children,
}: {
  headline: string;
  children: ReactNode;
}) {
  return (
    <div className="border-blaze/25 bg-blaze/10 flex items-center gap-3 rounded-xl border px-3.5 py-3">
      {/* The mark gets a disc of its own so the amber has somewhere to be
          concentrated, which is what lets the panel behind it stay this faint.
          Centred against the pair of lines rather than the first of them: it
          stands for the whole invitation, not for its top line. */}
      <span className="bg-blaze/20 text-blaze grid h-9 w-9 shrink-0 place-items-center rounded-full">
        <PickIcon
          weight="bold"
          aria-hidden
          className="h-[1.125rem] w-[1.125rem]"
        />
      </span>
      <div className="min-w-0">
        <p className="text-sand text-[0.9375rem] leading-tight">{headline}</p>
        <p className="text-sand/65 mt-1 text-[0.8125rem] leading-snug text-balance">
          {children}
        </p>
      </div>
    </div>
  );
}
