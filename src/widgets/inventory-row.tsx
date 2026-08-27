import { Crosshair } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utilities/style-utils";

type InventoryRowProps = {
  id: string;
  name: string | null;
  detail: string;
  selected?: boolean;
  onRename: (name: string) => void;
  onRemove: () => void;
  onHover?: (hovering: boolean) => void;
  onSelect?: () => void;
  onLocate?: () => void;
  /**
   * When this row becomes the selected one, bring it into view within its own
   * list — so picking something off the map shows you which row it was rather
   * than leaving you to go looking for it.
   */
  revealOnSelect?: boolean;
  /**
   * Also put the cursor in the name.
   *
   * Only where naming is the next thing anyone does, which is junctions: one
   * is placed in order to be labeled. Segments are not — their next step is
   * the attributes below, and stealing the caret up into the list meant
   * arriving at each one with the panel scrolled away from the work.
   */
  focusNameOnSelect?: boolean;
};

/**
 * One stored thing: what it is called, how big it is, and how to get rid of it.
 *
 * The name is an always-live input rather than an edit mode, because a mode is
 * a thing to enter and leave for what is really just typing. It reads as text
 * until touched, and commits on blur or Enter — not per keystroke, which would
 * be one write to disk per letter.
 */
export function InventoryRow({
  id,
  name,
  detail,
  selected = false,
  onRename,
  onRemove,
  onHover,
  onSelect,
  onLocate,
  revealOnSelect = false,
  focusNameOnSelect = false,
}: InventoryRowProps) {
  const [draft, setDraft] = useState(name ?? "");
  const row = useRef<HTMLLIElement>(null);
  const field = useRef<HTMLInputElement>(null);

  // Follow the stored name when it changes underneath us, but never while the
  // field is focused — that would overwrite what is being typed.
  useEffect(() => {
    setDraft(name ?? "");
  }, [name]);

  useEffect(() => {
    if (!selected || !revealOnSelect) return;
    const element = row.current;
    const list = element?.parentElement;
    if (!element || !list) return;

    // Scrolls the list and nothing above it. `scrollIntoView` walks every
    // scrollable ancestor, so revealing a row this far down the sidebar also
    // scrolled the sidebar — carrying whatever was being edited off screen.
    const rowBox = element.getBoundingClientRect();
    const listBox = list.getBoundingClientRect();
    if (rowBox.top < listBox.top) {
      list.scrollTop -= listBox.top - rowBox.top;
    } else if (rowBox.bottom > listBox.bottom) {
      list.scrollTop += rowBox.bottom - listBox.bottom;
    }

    // Focus without selecting: the caret lands in an existing name rather than
    // replacing it, so this is safe when the click was only to identify.
    if (focusNameOnSelect) field.current?.focus({ preventScroll: true });
  }, [selected, revealOnSelect, focusNameOnSelect]);

  function commit() {
    if (draft.trim() !== (name ?? "")) onRename(draft);
  }

  return (
    <li
      ref={row}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className={cn(
        "group border-sand/10 flex items-center gap-2 border-b py-1.5 pl-1 transition-colors last:border-b-0",
        selected ? "bg-blaze/10" : "hover:bg-sand/5",
      )}
    >
      <button
        type="button"
        onClick={onSelect}
        disabled={!onSelect}
        className={cn(
          "tabular shrink-0 text-xs transition-colors",
          selected ? "text-blaze" : "text-sand/70",
          onSelect && "hover:text-blaze cursor-pointer",
        )}
      >
        {id}
      </button>

      <input
        ref={field}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setDraft(name ?? "");
        }}
        placeholder="Add a name"
        aria-label={`Name for ${id}`}
        className={cn(
          "text-sand min-w-0 flex-1 rounded border border-transparent bg-transparent px-1.5 py-0.5 text-xs",
          "group-hover:placeholder:text-sand/70 focus:placeholder:text-sand/70 placeholder:text-transparent",
          "hover:border-sand/15 focus:border-blaze/60 focus:bg-forest-deep/40 focus:outline-none",
          "transition-colors",
        )}
      />

      <span className="tabular text-sand/70 shrink-0 text-[0.6875rem]">
        {detail}
      </span>

      {onLocate && (
        <button
          type="button"
          onClick={onLocate}
          aria-label={`Show ${id} on the map`}
          title="Show on the map"
          className="text-sand/70 hover:text-blaze focus-visible:text-blaze group-hover:text-sand/70 shrink-0 p-1 transition-colors focus-visible:outline-none"
        >
          <Crosshair weight="bold" className="h-3.5 w-3.5" />
        </button>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Delete ${id}`}
        className="text-sand/70 hover:text-blaze focus-visible:text-blaze group-hover:text-sand/70 shrink-0 px-1 text-xs transition-colors focus-visible:outline-none"
      >
        ✕
      </button>
    </li>
  );
}
