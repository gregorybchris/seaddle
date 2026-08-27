import { Info } from "@phosphor-icons/react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * A small "why is this like that?" note attached to a heading.
 *
 * Opened deliberately rather than on hover, so the explanation is available
 * without being in the way of someone who already knows — and so it works the
 * same on a phone, where there is no hover at all.
 *
 * Hand-rolled rather than reached for: the library version arrived with a
 * floating-position engine that cost more of the bundle than every icon in the
 * app put together, to place one panel that only ever opens upwards.
 */
export function InfoPopover({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);
  const id = useId();

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
        className="text-sand/70 hover:text-sand/70 focus-visible:ring-blaze rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <Info weight="bold" className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          id={id}
          role="note"
          // Anchored to its own corner and opening upward, which is the only
          // direction it is ever used in — the panel it lives in is scrolled
          // to the bottom by the time this is reachable.
          className="border-sand/20 bg-forest-deep text-sand/80 absolute bottom-full left-0 z-20 mb-2 w-60 rounded-lg border p-3 text-xs leading-relaxed normal-case shadow-lg"
        >
          {children}
        </span>
      )}
    </span>
  );
}
