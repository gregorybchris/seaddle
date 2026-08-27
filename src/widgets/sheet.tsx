import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utilities/style-utils";

export type Detent = "peek" | "half" | "full";

/** How much of the viewport the sheet shows at each resting height. */
const DETENT_VH: Record<Detent, number> = { peek: 16, half: 52, full: 88 };
const ORDER: Detent[] = ["peek", "half", "full"];
const SHEET_VH = DETENT_VH.full;

type SheetProps = {
  /** Always visible, even at the smallest height. Keep it short. */
  peek: ReactNode;
  /**
   * Raise the sheet when this becomes true, and lower it when it stops.
   *
   * Candidates arriving below the fold is the same as them not arriving, so
   * the panel comes up to meet them rather than waiting to be dragged.
   */
  raisedWhen?: boolean;
  /**
   * Drop the sheet out of the way whenever this changes.
   *
   * For the moments the answer is on the map rather than in the panel — asking
   * to be shown where something is, only for the panel to be covering it.
   */
  lowerOn?: unknown;
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
  peek,
  raisedWhen = false,
  lowerOn,
  children,
}: SheetProps) {
  const [detent, setDetent] = useState<Detent>("half");
  const [dragVh, setDragVh] = useState<number | null>(null);
  const drag = useRef<{ startY: number; startVh: number } | null>(null);

  const visibleVh = dragVh ?? DETENT_VH[detent];

  useEffect(() => {
    setDetent(raisedWhen ? "full" : "half");
  }, [raisedWhen]);

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
      event.currentTarget.setPointerCapture(event.pointerId);
      drag.current = { startY: event.clientY, startVh: DETENT_VH[detent] };
    },
    [detent],
  );

  const onPointerMove = useCallback((event: React.PointerEvent) => {
    if (!drag.current) return;
    const moved =
      ((drag.current.startY - event.clientY) / window.innerHeight) * 100;
    setDragVh(
      Math.min(
        SHEET_VH,
        Math.max(DETENT_VH.peek, drag.current.startVh + moved),
      ),
    );
  }, []);

  const onPointerUp = useCallback(() => {
    if (!drag.current) return;
    const settled = dragVh;
    drag.current = null;
    setDragVh(null);
    if (settled === null) return;
    // Snap to whichever resting height the drag ended nearest.
    const nearest = ORDER.reduce((best, option) =>
      Math.abs(DETENT_VH[option] - settled) <
      Math.abs(DETENT_VH[best] - settled)
        ? option
        : best,
    );
    setDetent(nearest);
  }, [dragVh]);

  const step = useCallback((direction: 1 | -1) => {
    setDetent((current) => {
      const next = ORDER.indexOf(current) + direction;
      return ORDER[Math.min(ORDER.length - 1, Math.max(0, next))];
    });
  }, []);

  return (
    <aside
      className={cn(
        "sheet bg-forest text-sand fixed inset-x-0 bottom-0 z-10 flex flex-col rounded-t-2xl",
        "shadow-[0_-8px_32px_rgba(18,48,31,0.28)]",
        "md:static md:w-[22rem] md:rounded-none md:shadow-none lg:w-96",
        dragVh === null &&
          "transition-transform duration-300 ease-[var(--ease-settle)]",
      )}
      style={
        {
          "--sheet-height": SHEET_VH,
          "--sheet-visible": visibleVh,
        } as React.CSSProperties
      }
    >
      <div
        role="separator"
        aria-label="Resize panel"
        aria-orientation="horizontal"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp") step(1);
          if (event.key === "ArrowDown") step(-1);
        }}
        className="focus-visible:ring-blaze flex cursor-grab touch-none justify-center py-3 focus-visible:ring-2 focus-visible:outline-none active:cursor-grabbing md:hidden"
      >
        <span className="bg-sand/30 h-1 w-10 rounded-full" />
      </div>

      <div className="shrink-0 px-5 pb-3 md:pt-5">{peek}</div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6">
        {children}
      </div>
    </aside>
  );
}
