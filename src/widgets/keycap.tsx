import type { ReactNode } from "react";
import { cn } from "@/lib/utilities/style-utils";

/**
 * One key, drawn as a key.
 *
 * The same three parts every pressable thing on this site is built from — a
 * solid fill, a deeper edge, and a hard offset shadow beneath it — at the size
 * of a word rather than of a button. Nothing here is pressable, which is
 * exactly why it borrows the shape: a rider being told to press something
 * should be shown the thing they are pressing rather than its name in a
 * different font.
 *
 * Built out of the panel rather than laid on top of it: the same lifted green,
 * sand hairline and forest shadow the outline button wears, which is the
 * button these keys are mostly describing. A pale cap does read as a physical
 * key, and at this size a row of them is a row of bright chips down the side
 * of a dark dialog — brighter than the settings they are listed under, which
 * puts the loudest thing in the panel on the part nobody came for.
 */
export function Keycap({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        // A fixed height rather than padding, so a cap carrying an outsized
        // symbol still stands exactly as tall as the letter beside it.
        "border-sand/25 bg-forest-lift/40 text-sand inline-grid h-6 min-w-6 place-items-center",
        "rounded border px-1.5 font-mono text-xs leading-none",
        "shadow-[2px_2px_0_var(--color-forest-deep)]",
        className,
      )}
    >
      {typeof children === "string" ? enlarged(children) : children}
    </kbd>
  );
}

/**
 * The marks a keyboard prints on its keys, which no text face treats as type.
 *
 * None of these is in the latin subset of the mono face this site loads, so
 * every one of them falls through to whatever mono the machine has — and those
 * draw a symbol to fit inside the x-height, where a letter gets the full body.
 * Set solid against a Z they come out looking like a footnote to it.
 */
const SYMBOL = /[\u2318\u21e7\u232b\u2325\u238b]/;

/**
 * The symbols in a key's name, drawn up to the size the letters already are.
 *
 * Handed back as one span rather than as the pieces: the cap is a grid, and a
 * ⌘ and a Z arriving as two children of one are two rows of it — which is a
 * key spelled downwards.
 */
function enlarged(name: string): ReactNode {
  return (
    <span className="whitespace-nowrap">
      {name.split(new RegExp(`(${SYMBOL.source})`)).map((part, at) => (
        // Middle rather than the baseline every one of these would otherwise
        // share. A ⌘ drawn a third larger than the Z beside it sits on that
        // baseline and grows in one direction only, so it rides up off the
        // letter — and the symbols do not even agree among themselves, since
        // each one is whatever fallback face on the machine happens to carry
        // it. Centering every piece against the same line is the one rule that
        // holds whatever turns up.
        <span key={at} className="align-middle leading-none">
          {SYMBOL.test(part) ? (
            <span className="text-[1.3em] leading-none">{part}</span>
          ) : (
            part
          )}
        </span>
      ))}
    </span>
  );
}
