import {
  PIN_KINDS,
  PIN_LABELS,
  type Pin,
  type PinKind,
} from "@/lib/models/graph";
import { Button } from "@/widgets/button";
import { ChipGroup } from "@/widgets/chip-group";
import { PinMark } from "@/widgets/pin-mark";

type PinEditorProps = {
  pins: Pin[];
  selected: Pin | null;
  onSelect: (id: string | null) => void;
  onKind: (kind: PinKind) => void;
  onNote: (note: string) => void;
  onRemove: () => void;
  onLocate: (pin: Pin) => void;
  dropping: PinKind | null;
  onDropping: (kind: PinKind | null) => void;
};

/**
 * The things worth knowing about along a road.
 *
 * Dropping one is armed rather than modal: pick what you are adding, then click
 * the road. The click answers which segment and how far along at once, so a pin
 * belongs to a road from the moment it exists rather than floating near one.
 */
export function PinEditor({
  pins,
  selected,
  onSelect,
  onKind,
  onNote,
  onRemove,
  onLocate,
  dropping,
  onDropping,
}: PinEditorProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="border-sand/15 bg-forest-deep/30 flex flex-col gap-2 rounded-lg border p-2.5">
        <ChipGroup
          label={dropping ? "Now click the road" : "Add a pin"}
          options={PIN_KINDS}
          value={dropping}
          onChange={(kind: PinKind) =>
            onDropping(dropping === kind ? null : kind)
          }
        />
        {dropping && (
          <Button
            variant="quiet"
            className="min-h-0 self-start px-2 py-1 text-xs"
            onClick={() => onDropping(null)}
          >
            Cancel
          </Button>
        )}
      </div>

      {selected && (
        <div className="border-sand/15 bg-forest-deep/30 flex flex-col gap-2 rounded-lg border p-2.5">
          <div className="flex items-center gap-2">
            <PinMark kind={selected.kind} selected />
            <span className="tabular text-blaze flex-1 text-xs">
              {selected.id}
            </span>
            <Button
              variant="quiet"
              className="min-h-0 px-2 py-1 text-xs"
              onClick={onRemove}
            >
              Remove
            </Button>
          </div>
          <ChipGroup
            label="It is a"
            options={PIN_KINDS}
            value={selected.kind}
            onChange={onKind}
          />
          <input
            key={selected.id}
            defaultValue={selected.note ?? ""}
            onBlur={(event) => onNote(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            placeholder="Note — where exactly, or what to expect"
            aria-label="Pin note"
            className="border-sand/15 bg-forest-deep/40 text-sand placeholder:text-sand/70 focus:border-blaze/60 rounded-md border px-2 py-1.5 text-xs transition-colors focus:outline-none"
          />
        </div>
      )}

      {pins.length > 0 && (
        <ul className="flex flex-col">
          {pins.map((pin) => (
            <li
              key={pin.id}
              className="border-sand/10 group flex items-center gap-2 border-b py-1.5 last:border-b-0"
            >
              <button
                type="button"
                onClick={() =>
                  onSelect(pin.id === selected?.id ? null : pin.id)
                }
                className="flex min-w-0 flex-1 items-center gap-2 text-left"
              >
                <PinMark
                  kind={pin.kind}
                  className="h-4 w-4 shrink-0"
                  selected={pin.id === selected?.id}
                />
                <span className="text-sand/80 truncate text-xs">
                  {pin.note ?? PIN_LABELS[pin.kind]}
                </span>
              </button>
              <button
                type="button"
                onClick={() => onLocate(pin)}
                aria-label={`Show ${pin.id} on the map`}
                className="text-sand/70 hover:text-blaze group-hover:text-sand/70 shrink-0 px-1 text-[0.6875rem] transition-colors"
              >
                show
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
