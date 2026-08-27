import { formatFeet, formatMiles } from "@/lib/utilities/units";
import { Button } from "@/widgets/button";
import type { Candidate } from "../candidate-finder";

type CandidateListProps = {
  candidates: Candidate[];
  onHover: (candidate: Candidate | null) => void;
  onChoose: (candidate: Candidate) => void;
  expanded: string | null;
  onExpand: (track: string | null) => void;
};

/**
 * The ranked candidates, with the numbers that produced the ranking on show.
 *
 * The point of this panel is that the choice stays a human one. The scoring
 * puts the most direct, best-drawn geometry first, but detour ratio and point
 * count are visible so a wrong ordering is obvious rather than invisible.
 */
export function CandidateList({
  candidates,
  onHover,
  onChoose,
  expanded,
  onExpand,
}: CandidateListProps) {
  if (candidates.length === 0) {
    return (
      <p className="text-ink/60 text-sm">
        No ride runs between these two junctions without wandering. Try a wider
        detour allowance, or a junction closer to the roads that connect them.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {candidates.map((candidate) => (
        <li key={`${candidate.track}-${candidate.startIndex}`}>
          <div
            className="border-ink/15 hover:border-forest rounded-md border-2 bg-white/60 p-2"
            onMouseEnter={() => onHover(candidate)}
            onMouseLeave={() => onHover(null)}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-sm">{candidate.trackName}</span>
              <span className="text-ink/50 shrink-0 text-xs">
                {formatMiles(candidate.meters)}
              </span>
            </div>
            <dl className="text-ink/60 mt-1 flex flex-wrap gap-x-3 text-xs">
              <span>↑ {formatFeet(candidate.gainForward)}</span>
              <span>detour ×{candidate.detourRatio.toFixed(2)}</span>
              <span>{candidate.pointCount} pts</span>
              <span>off by {candidate.endpointMeters.toFixed(0)} m</span>
            </dl>
            <div className="mt-2 flex gap-2">
              <Button
                variant="primary"
                className="px-2 py-1 text-xs"
                onClick={() => onChoose(candidate)}
              >
                Use this
              </Button>
              {candidate.alternates.length > 0 && (
                <Button
                  variant="quiet"
                  className="px-2 py-1 text-xs"
                  onClick={() =>
                    onExpand(
                      expanded === candidate.track ? null : candidate.track,
                    )
                  }
                >
                  {candidate.alternates.length} other pass
                  {candidate.alternates.length > 1 ? "es" : ""}
                </Button>
              )}
            </div>
          </div>

          {expanded === candidate.track && (
            <ul className="mt-1 ml-3 flex flex-col gap-1">
              {candidate.alternates.map((alternate) => (
                <li
                  key={alternate.startIndex}
                  className="border-ink/10 flex items-center justify-between gap-2 rounded border p-1.5 text-xs"
                  onMouseEnter={() => onHover(alternate)}
                  onMouseLeave={() => onHover(null)}
                >
                  <span className="text-ink/60">
                    {formatMiles(alternate.meters)} · ×
                    {alternate.detourRatio.toFixed(2)}
                  </span>
                  <Button
                    variant="quiet"
                    className="px-2 py-0.5 text-xs"
                    onClick={() => onChoose(alternate)}
                  >
                    Use
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
