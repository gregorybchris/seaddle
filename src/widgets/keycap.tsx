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
 * button most of these keys are describing. A pale cap does read as a physical
 * key, and at this size a row of them is a row of bright chips down the side
 * of a dark dialog — brighter than the settings they are listed under.
 *
 * One key to a cap, and the key spelled rather than drawn. ⌘ and ⌫ are not in
 * any face this site loads, so each fell through to whatever the machine had —
 * at its own size, on its own baseline, and in one case with the ink hanging
 * out of the box it was spaced in. A word is in the font already.
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
        // A fixed height rather than padding, so every cap in a column stands
        // exactly as tall as the shortest thing in it.
        "border-sand/25 bg-forest-lift/40 text-sand inline-grid h-6 min-w-6 place-items-center",
        "rounded border px-2 font-mono text-xs leading-none whitespace-nowrap",
        "shadow-[2px_2px_0_var(--color-forest-deep)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
