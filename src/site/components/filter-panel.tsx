import {
  LANE_QUALITIES,
  SCENICS,
  STEEPNESSES,
  SURFACES,
  type Steepness,
  type LaneQuality,
  type Scenic,
} from "@/lib/models/graph";
import { Funnel } from "@phosphor-icons/react";
import { cn } from "@/lib/utilities/style-utils";
import { humanize } from "@/lib/utilities/words";
import { Button } from "@/widgets/button";
import { ChipGroup } from "@/widgets/chip-group";
import { ChipToggles } from "@/widgets/chip-toggles";
import { CollapsibleSection } from "@/widgets/collapsible-section";
import {
  ENCODINGS,
  ENCODING_VALUES,
  isFiltering,
  NO_FILTERS,
  RAMPS,
  type Encoding,
  type Filters,
} from "../filters";

type FilterPanelProps = {
  filters: Filters;
  onFilters: (filters: Filters) => void;
  encoding: Encoding;
  onEncoding: (encoding: Encoding) => void;
  /** How many roads currently clear the bar, out of how many there are. */
  passing: number;
  total: number;
};

/**
 * What a rider will put up with, and what the map should be colored by.
 *
 * Nothing here hides a road. Failing a filter dims it, because hiding would
 * break the network into islands and leave someone staring at a gap with no
 * way to see why it is there.
 */
export function FilterPanel({
  filters,
  onFilters,
  encoding,
  onEncoding,
  passing,
  total,
}: FilterPanelProps) {
  const on = isFiltering(filters);

  return (
    <CollapsibleSection
      title="Filters"
      // Amber once something is set, so a folded section still says it is
      // doing something to the map.
      icon={
        <Funnel
          weight={on ? "fill" : "bold"}
          aria-hidden
          className={cn("h-3 w-3", on ? "text-blaze" : "text-sand/70")}
        />
      }
      count={on ? passing : total}
    >
      <div className="flex flex-col gap-4">
        <ChipGroup
          label="Color the map by"
          options={ENCODINGS}
          value={encoding}
          onChange={onEncoding}
        />
        <Legend encoding={encoding} />

        <div className="border-sand/10 flex flex-col gap-3 border-t pt-3">
          <ChipGroup
            label="Nothing steeper than"
            options={STEEPNESSES}
            value={filters.steepest}
            onChange={(steepest: Steepness) =>
              onFilters({ ...filters, steepest })
            }
          />
          <ChipGroup
            label="Bike lane at least"
            options={LANE_QUALITIES}
            value={filters.leastLaneQuality}
            onChange={(leastLaneQuality: LaneQuality) =>
              onFilters({ ...filters, leastLaneQuality })
            }
          />
          <ChipGroup
            label="Scenic at least"
            options={SCENICS}
            value={filters.leastScenic}
            onChange={(leastScenic: Scenic) =>
              onFilters({ ...filters, leastScenic })
            }
          />
          <ChipToggles
            label="Surface"
            options={SURFACES}
            values={filters.surfaces}
            onChange={(surfaces) => onFilters({ ...filters, surfaces })}
          />
        </div>

        {on && (
          <div className="flex items-center gap-2">
            <span className="tabular text-sand/70 flex-1 text-[0.6875rem]">
              {passing} of {total} roads
            </span>
            <Button
              variant="quiet"
              className="min-h-0 px-2 py-1 text-xs"
              onClick={() => onFilters(NO_FILTERS)}
            >
              Clear
            </Button>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

/** What the colors on the map currently mean. */
function Legend({ encoding }: { encoding: Encoding }) {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {ENCODING_VALUES[encoding].map((value) => (
        <li key={value} className="flex items-center gap-1.5">
          {/* Outlined, because the dark end of a ramp tuned for a pale
              basemap is exactly this panel's own color. */}
          <span
            aria-hidden
            className="ring-sand/30 h-1.5 w-4 rounded-full ring-1"
            style={{ backgroundColor: RAMPS[encoding][value] }}
          />
          <span className="text-sand/70 text-[0.6875rem]">
            {humanize(value)}
          </span>
        </li>
      ))}
    </ul>
  );
}
