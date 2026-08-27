import * as Collapsible from "@radix-ui/react-collapsible";
import { CaretDown } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utilities/style-utils";
import { SearchField } from "./search-field";

type CollapsibleSectionProps = {
  title: string;
  /** Shown beside the title so a closed section still says how much is inside. */
  count: number;
  search?: { value: string; onChange: (value: string) => void; label: string };
  defaultOpen?: boolean;
  children: ReactNode;
};

/**
 * A titled list that folds away.
 *
 * The count sits in the header rather than inside, so collapsing a section
 * hides the rows without hiding the fact that they exist. Search lives under
 * the header and only inside an open section — filtering something you cannot
 * see would be a control with no visible effect.
 */
export function CollapsibleSection({
  title,
  count,
  search,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible.Root
      open={open}
      onOpenChange={setOpen}
      className="flex flex-col gap-2"
    >
      <Collapsible.Trigger
        className={cn(
          "group focus-visible:ring-blaze -mx-1 flex items-center gap-2 rounded px-1 py-1",
          "focus-visible:ring-2 focus-visible:outline-none",
        )}
      >
        <CaretDown
          weight="bold"
          aria-hidden
          className={cn(
            "text-sand/40 group-hover:text-sand/70 h-3 w-3 transition-transform duration-200 ease-[var(--ease-settle)]",
            !open && "-rotate-90",
          )}
        />
        <span className="eyebrow text-sand/40 group-hover:text-sand/70 transition-colors">
          {title}
        </span>
        <span className="tabular text-sand/30 text-[0.625rem]">{count}</span>
      </Collapsible.Trigger>

      <Collapsible.Content className="collapsible-panel">
        <div className="flex flex-col gap-2">
          {search && count > 0 && (
            <SearchField
              value={search.value}
              onChange={search.onChange}
              label={search.label}
            />
          )}
          {children}
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
}
