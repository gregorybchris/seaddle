import { Funnel, Palette } from "@phosphor-icons/react";
import { useState } from "react";
import type { BasemapId } from "@/lib/basemap";
import { BasemapChoices } from "@/widgets/basemap-choices";
import { ChipGroup } from "@/widgets/chip-group";
import { Dialog } from "@/widgets/dialog";
import { MapButton } from "@/widgets/map-button";
import { ENCODINGS, type Encoding } from "../encoding";
import type { Filters } from "../filters";
import { FilterPanel } from "./filter-panel";

type MapControlsProps = {
  encoding: Encoding;
  onEncoding: (encoding: Encoding) => void;
  basemap: BasemapId;
  onBasemap: (id: BasemapId) => void;
  filters: Filters;
  onFilters: (filters: Filters) => void;
  passing: number;
  total: number;
};

/**
 * The settings that used to sit in the panel, as two buttons on the map.
 *
 * They left the panel because neither is part of building a route: a rider sets
 * a filter or a color once and then spends the rest of the session picking
 * roads, with the controls for both taking up room the whole time. Behind a
 * button they cost nothing until they are wanted.
 *
 * Both colors live in one dialog. What the map is colored *by* and what it is
 * drawn *on* were in different places for no reason other than having been
 * built at different times, and the second is only ever adjusted because of how
 * it sits under the first.
 */
export function MapControls({
  encoding,
  onEncoding,
  basemap,
  onBasemap,
  filters,
  onFilters,
  passing,
  total,
}: MapControlsProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);

  return (
    <>
      <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
        <MapButton
          aria-label="Filters"
          aria-haspopup="dialog"
          onClick={() => setFiltersOpen(true)}
        >
          <Funnel size={17} weight="bold" />
        </MapButton>
        <MapButton
          aria-label="Map colors"
          aria-haspopup="dialog"
          onClick={() => setColorsOpen(true)}
        >
          <Palette size={17} weight="bold" />
        </MapButton>
      </div>

      <Dialog
        open={filtersOpen}
        onOpenChange={setFiltersOpen}
        title="Filters"
        description="Segments that do not meet the selected criteria are dimmed."
      >
        <FilterPanel
          filters={filters}
          onFilters={onFilters}
          passing={passing}
          total={total}
        />
      </Dialog>

      <Dialog open={colorsOpen} onOpenChange={setColorsOpen} title="Map colors">
        <div className="flex flex-col gap-4">
          <ChipGroup
            label="Segment color"
            options={ENCODINGS}
            value={encoding}
            onChange={onEncoding}
          />
          <div className="border-sand/10 border-t pt-4">
            <BasemapChoices value={basemap} onChange={onBasemap} />
          </div>
        </div>
      </Dialog>
    </>
  );
}
