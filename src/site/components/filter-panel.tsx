import {
  PROTECTIONS,
  SURROUNDINGS,
  STEEPNESSES,
  type Steepness,
  type Protection,
  type Surroundings,
} from "@/lib/models/graph";
import { Button } from "@/widgets/button";
import { ChipGroup } from "@/widgets/chip-group";
import { isFiltering, NO_FILTERS, type Filters } from "../filters";

type FilterPanelProps = {
  filters: Filters;
  onFilters: (filters: Filters) => void;
  /** How many segments currently clear the bar, out of how many there are. */
  passing: number;
  total: number;
};

/**
 * What a rider will put up with.
 *
 * Nothing here hides a road. Failing a filter dims it, because hiding would
 * break the network into islands and leave someone staring at a gap with no
 * way to see why it is there.
 */
export function FilterPanel({
  filters,
  onFilters,
  passing,
  total,
}: FilterPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <ChipGroup
          label="Nothing steeper than"
          joined
          options={STEEPNESSES}
          value={filters.steepest}
          onChange={(steepest: Steepness) =>
            onFilters({ ...filters, steepest })
          }
        />
        <ChipGroup
          label="At least this protected"
          joined
          options={PROTECTIONS}
          value={filters.leastProtection}
          onChange={(leastProtection: Protection) =>
            onFilters({ ...filters, leastProtection })
          }
        />
        <ChipGroup
          label="At least this pretty"
          joined
          options={SURROUNDINGS}
          value={filters.leastSurroundings}
          onChange={(leastSurroundings: Surroundings) =>
            onFilters({ ...filters, leastSurroundings })
          }
        />
      </div>

      {/* The count is the only thing that says a filter is doing anything —
          the map dims rather than hides, so a rider who set one and forgot has
          this to come back to. */}
      {isFiltering(filters) && (
        <div className="border-sand/10 flex items-center gap-2 border-t pt-3">
          <span className="tabular text-sand/70 flex-1 text-[0.6875rem]">
            {passing} of {total} segments
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
  );
}
