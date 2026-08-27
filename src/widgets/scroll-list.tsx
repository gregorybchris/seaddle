import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utilities/style-utils";

/**
 * How many rows a list shows before it starts scrolling.
 *
 * Kept deliberately short so that junctions and segments are both on screen at
 * once — which is the point of bounding them at all. A list long enough to fill
 * the panel pushes the next section out of sight and costs more scrolling than
 * it saves. Five rows, with the sixth half-showing at the fade, is enough to
 * work in while leaving room for the section underneath.
 */
const ROWS_BEFORE_SCROLL = 5;

type ScrollListProps = {
  /** Row count, watched so the newest row can be brought into view. */
  count: number;
  children: ReactNode;
};

export function ScrollList({ count, children }: ScrollListProps) {
  const ref = useRef<HTMLUListElement>(null);
  const previous = useRef<number | null>(null);

  useEffect(() => {
    const list = ref.current;
    if (!list) return;
    const grew = previous.current !== null && count > previous.current;
    const first = previous.current === null;
    previous.current = count;
    if (!grew && !first) return;

    // Newest is last, so the bottom is where the work is. Sliding there on a
    // fresh row points the eye at it; on first render there is nothing to
    // point at yet, so it just starts in the right place.
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    list.scrollTo({
      top: list.scrollHeight,
      behavior: first || reduced ? "auto" : "smooth",
    });
  }, [count]);

  const scrolls = count > ROWS_BEFORE_SCROLL;

  return (
    <ul
      ref={ref}
      className={cn(
        "flex flex-col overflow-y-auto overscroll-contain",
        scrolls && "max-h-[7.5rem] md:max-h-[10.5rem]",
        // Softened at both edges only once there is something out of sight, so
        // the fade reads as "there is more" rather than as decoration.
        scrolls && "scroll-faded",
      )}
    >
      {children}
    </ul>
  );
}
