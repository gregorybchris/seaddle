import { useState } from "react";
import { cn } from "@/lib/utilities/style-utils";
import { formatRideDate } from "@/lib/utilities/dates";
import { formatFeet, formatMiles } from "@/lib/utilities/units";
import { Button } from "@/widgets/button";
import { Sparkline } from "@/widgets/sparkline";
import type { Candidate } from "../candidate-finder";

type CandidateListProps = {
  candidates: Candidate[];
  onHover: (candidate: Candidate | null) => void;
  onChoose: (candidate: Candidate) => void;
};

export function CandidateList({
  candidates,
  onHover,
  onChoose,
}: CandidateListProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (candidates.length === 0) {
    return (
      <p className="border-sand/15 text-sand/60 rounded-lg border border-dashed px-3 py-4 text-xs leading-relaxed">
        No ride runs between these two junctions without wandering. Widen the
        detour allowance, or put a junction where the roads actually connect.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {candidates.map((candidate, index) => (
        <li
          key={`${candidate.track}-${candidate.startIndex}`}
          className="rise"
          style={{ animationDelay: `${index * 40}ms` }}
        >
          <CandidateCard
            candidate={candidate}
            rank={index + 1}
            onHover={onHover}
            onChoose={onChoose}
            expanded={expanded === candidate.track}
            onToggle={() =>
              setExpanded(expanded === candidate.track ? null : candidate.track)
            }
          />
        </li>
      ))}
    </ul>
  );
}

/**
 * One piece of candidate geometry, with the numbers that ranked it.
 *
 * The climb is drawn rather than only counted, because the shape of a hill is
 * what decides whether a beginner enjoys a segment, and it is the one thing a
 * distance and a total cannot tell you. The numbers stay visible so a wrong
 * ordering is obvious instead of hidden inside the score.
 */
function CandidateCard({
  candidate,
  rank,
  onHover,
  onChoose,
  expanded,
  onToggle,
}: {
  candidate: Candidate;
  rank: number;
  onHover: (candidate: Candidate | null) => void;
  onChoose: (candidate: Candidate) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onMouseEnter={() => onHover(candidate)}
      onMouseLeave={() => onHover(null)}
      className={cn(
        "group border-sand/12 bg-forest-lift/30 relative overflow-hidden rounded-lg border pl-4",
        "transition-[background-color,border-color,transform] duration-200 ease-[var(--ease-settle)]",
        "hover:border-blaze/50 hover:bg-forest-lift/60 hover:-translate-y-px",
      )}
    >
      {/* Grows on hover, and the map lights up the same geometry at the same
          moment — the card and the line are one object in two places. */}
      <span className="bg-blaze/40 group-hover:bg-blaze absolute inset-y-0 left-0 w-1 transition-[width,background-color] duration-200 group-hover:w-1.5" />

      <div className="flex flex-col gap-1.5 p-2.5 pl-2">
        <div className="flex items-baseline gap-2">
          <span className="tabular text-sand/30 text-[0.625rem]">{rank}</span>
          {/* Strava names every ride "Afternoon Ride", so when there is a date
              it is the thing that tells one candidate from another and leads.
              A drawn route has no date but was named by hand, so its name does
              the same job. */}
          <span className="text-sand truncate text-sm">
            {candidate.trackDate
              ? formatRideDate(candidate.trackDate)
              : candidate.trackName}
          </span>
          <span className="tabular text-sand ml-auto shrink-0 text-xs">
            {formatMiles(candidate.meters)}
          </span>
        </div>
        {candidate.trackDate && (
          <span className="text-sand/40 -mt-1 truncate text-[0.6875rem]">
            {candidate.trackName}
          </span>
        )}

        <Sparkline
          points={candidate.points}
          className="text-moss group-hover:text-blaze h-5 transition-colors duration-200"
        />

        <dl className="tabular text-sand/50 flex flex-wrap gap-x-3 text-[0.6875rem]">
          <span>↑{formatFeet(candidate.gainForward)}</span>
          <span>×{candidate.detourRatio.toFixed(2)}</span>
          <span>{candidate.pointCount}pt</span>
          <span>{candidate.endpointMeters.toFixed(0)}m off</span>
        </dl>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className={cn(
              "min-h-9 flex-1 px-2 text-xs",
              "group-hover:border-blaze-deep group-hover:bg-blaze group-hover:text-forest-deep",
              "group-hover:shadow-[2px_2px_0_0_var(--color-blaze-deep)]",
            )}
            onClick={() => onChoose(candidate)}
          >
            Use this
          </Button>
          {candidate.alternates.length > 0 && (
            <Button
              variant="quiet"
              className="min-h-9 px-2 text-xs"
              onClick={onToggle}
            >
              {expanded ? "Hide" : `+${candidate.alternates.length}`}
            </Button>
          )}
        </div>

        {expanded && (
          <ul className="border-sand/10 flex flex-col gap-1 border-t pt-2">
            {candidate.alternates.map((alternate) => (
              <li
                key={alternate.startIndex}
                onMouseEnter={() => onHover(alternate)}
                className="flex items-center gap-2"
              >
                <span className="tabular text-sand/50 flex-1 text-[0.6875rem]">
                  {formatMiles(alternate.meters)} · ×
                  {alternate.detourRatio.toFixed(2)}
                </span>
                <Button
                  variant="quiet"
                  className="min-h-8 px-2 text-[0.6875rem]"
                  onClick={() => onChoose(alternate)}
                >
                  Use
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
