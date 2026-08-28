import { BASEMAPS, type BasemapId } from "@/lib/basemap";
import { ChipGroup } from "@/widgets/chip-group";

/**
 * Which ground the map is drawn on.
 *
 * Chips rather than a dropdown. There are five of them, they are all one word
 * or two, and seeing the range of answers is most of the decision — the same
 * reasoning that keeps every other short scale on this site out of a menu.
 * They are not an ordered scale, so they wrap rather than joining into a bar.
 */
export function BasemapChoices({
  value,
  onChange,
}: {
  value: BasemapId;
  onChange: (id: BasemapId) => void;
}) {
  return (
    <ChipGroup
      label="Map style"
      options={BASEMAPS.map((basemap) => basemap.id)}
      value={value}
      onChange={onChange}
      swatchFor={(id) =>
        BASEMAPS.find((basemap) => basemap.id === id)?.accent ?? "transparent"
      }
      // Lowercased at the point of display, the way `humanize` leaves every
      // other chip on the site — the names stay capitalised where they are
      // defined, because that is what they are called.
      labelFor={(id) =>
        (
          BASEMAPS.find((basemap) => basemap.id === id)?.name ?? id
        ).toLowerCase()
      }
    />
  );
}
