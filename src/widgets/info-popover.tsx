import { Info } from "@phosphor-icons/react";
import * as Popover from "@radix-ui/react-popover";
import type { ReactNode } from "react";

/**
 * A small "why is this like that?" note attached to a heading.
 *
 * Opened deliberately rather than on hover, so the explanation is available
 * without being in the way of someone who already knows — and so it works the
 * same on a phone, where there is no hover at all.
 */
export function InfoPopover({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label={label}
        className="text-sand/30 hover:text-sand/70 focus-visible:ring-blaze rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <Info weight="bold" className="h-3.5 w-3.5" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="border-sand/20 bg-forest-deep text-sand/80 z-20 max-w-64 rounded-lg border p-3 text-xs leading-relaxed shadow-lg"
        >
          {children}
          <Popover.Arrow className="fill-forest-deep" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
