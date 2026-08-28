import { Info } from "@phosphor-icons/react";
import { cn } from "@/lib/utilities/style-utils";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** The gap held between the note and the thing it belongs to, in pixels. */
const GAP = 8;

/**
 * The box that would cut this off.
 *
 * Anything that scrolls or hides its overflow clips its children, and the note
 * is absolutely positioned inside one — so the space that matters is the space
 * inside that ancestor, not inside the window. Falls back to the viewport when
 * nothing above it clips.
 */
function clipperOf(node: HTMLElement): { top: number; bottom: number } {
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const overflow = getComputedStyle(parent).overflowY;
    if (overflow !== "visible") return parent.getBoundingClientRect();
  }
  return { top: 0, bottom: window.innerHeight };
}

/**
 * A small "why is this like that?" note attached to a heading.
 *
 * Opened deliberately rather than on hover, so the explanation is available
 * without being in the way of someone who already knows — and so it works the
 * same on a phone, where there is no hover at all.
 *
 * Hand-rolled rather than reached for: the library version arrived with a
 * floating-position engine that cost more of the bundle than every icon in the
 * app put together, to place one panel.
 *
 * It opens upward by preference and downward when there is no room, measured
 * against whichever ancestor would clip it rather than against the window. The
 * note lives inside a scrolling panel, and a scrolling panel cuts off anything
 * that reaches past its edge — so the window having room is no help at all.
 */
export function InfoPopover({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [side, setSide] = useState<"above" | "below">("above");
  const wrap = useRef<HTMLSpanElement>(null);
  const note = useRef<HTMLSpanElement>(null);
  const id = useId();

  // Before the browser paints, so a note that has to flip is never seen in the
  // wrong place first.
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = wrap.current;
    const panel = note.current;
    if (!anchor || !panel) return;

    const box = anchor.getBoundingClientRect();
    const limit = clipperOf(anchor);
    const needed = panel.offsetHeight + GAP;
    const above = box.top - limit.top;
    const below = limit.bottom - box.bottom;

    // Upward unless that would be cut off and downward would not. Where
    // neither fits, the roomier side loses the least.
    setSide(above >= needed || above >= below ? "above" : "below");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", dismiss);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", dismiss);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={wrap} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={() => setOpen((was) => !was)}
        className="text-sand/60 hover:text-blaze focus-visible:ring-blaze rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none motion-reduce:transition-none"
      >
        <Info weight="bold" className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          id={id}
          role="note"
          // Anchored to its own left corner, on whichever side the measurement
          // above settled on.
          ref={note}
          className={cn(
            "absolute left-0 z-20 w-64 rounded-lg border p-3.5",
            // The same materials the map's own popup is built from, so the two
            // notes on this site read as the same kind of thing.
            "border-sand/20 bg-forest-deep text-sand/85 shadow-[0_4px_16px_rgb(18_48_31_/_0.45)]",
            // This lives inside an eyebrow heading, which is mono, uppercase,
            // medium and tracked a seventh of an em apart. That is a good
            // setting for a two-word label and a bad one for three sentences,
            // and every part of it is inherited — so every part is put back.
            "font-sans text-[0.8125rem] leading-relaxed font-normal tracking-normal normal-case",
            side === "above" ? "bottom-full mb-2" : "top-full mt-2",
          )}
        >
          {/* Points back at the mark that opened it, so the note is attached to
              its question rather than floating near it. */}
          <span
            aria-hidden
            className={cn(
              "border-sand/20 bg-forest-deep absolute left-3 h-2 w-2 rotate-45",
              side === "above"
                ? "-bottom-[5px] border-r border-b"
                : "-top-[5px] border-t border-l",
            )}
          />
          {children}
        </span>
      )}
    </span>
  );
}
