import { Warning, WarningOctagon } from "@phosphor-icons/react";
import type { GraphProblem } from "@/lib/db/graph-file";
import { cn } from "@/lib/utilities/style-utils";
import { CollapsibleSection } from "@/widgets/collapsible-section";

type ValidationPanelProps = {
  problems: GraphProblem[];
  components: number[];
  onShowNodes: (ids: string[]) => void;
  onShowSegments: (ids: string[]) => void;
};

/**
 * What the graph is unhappy about, where it can be acted on.
 *
 * These checks already ran on every build — they were just printed to a
 * terminal nobody was reading, which is how a duplicate pair sat unnoticed
 * through a hundred and fifty segments. Each one names what it found, and
 * naming it means it can be gone to.
 */
export function ValidationPanel({
  problems,
  components,
  onShowNodes,
  onShowSegments,
}: ValidationPanelProps) {
  const errors = problems.filter((problem) => problem.level === "error");

  return (
    <CollapsibleSection
      title="Health"
      icon={
        errors.length > 0 ? (
          <WarningOctagon
            weight="fill"
            aria-hidden
            className="h-3 w-3 text-red-300"
          />
        ) : (
          <Warning
            weight={problems.length > 0 ? "fill" : "bold"}
            aria-hidden
            className={cn(
              "h-3 w-3",
              problems.length > 0 ? "text-blaze" : "text-moss",
            )}
          />
        )
      }
      count={problems.length}
      defaultOpen={false}
    >
      <div className="flex flex-col gap-2">
        {problems.length === 0 && (
          <p className="text-moss text-xs">Nothing to report.</p>
        )}

        {problems.map((problem, index) => (
          <div
            key={`${problem.message}-${index}`}
            className={cn(
              "rounded-lg border px-2.5 py-2 text-xs leading-relaxed",
              problem.level === "error"
                ? "border-red-400/40 bg-red-400/10 text-red-200"
                : "border-sand/15 bg-forest-deep/30 text-sand/75",
            )}
          >
            <p>{problem.message}</p>
            {(problem.nodes?.length || problem.segments?.length) && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {problem.segments && problem.segments.length > 0 && (
                  <Jump
                    label={`${problem.segments.length} segment${problem.segments.length > 1 ? "s" : ""}`}
                    onClick={() => onShowSegments(problem.segments ?? [])}
                  />
                )}
                {problem.nodes && problem.nodes.length > 0 && (
                  <Jump
                    label={`${problem.nodes.length} junction${problem.nodes.length > 1 ? "s" : ""}`}
                    onClick={() => onShowNodes(problem.nodes ?? [])}
                  />
                )}
              </div>
            )}
          </div>
        ))}

        {components.length > 1 && (
          <p className="text-sand/45 text-[0.6875rem] leading-relaxed">
            {components.length} separate networks: {components.join(", ")}{" "}
            junctions. Rides that never met each other are a normal thing to
            have, not a fault.
          </p>
        )}
      </div>
    </CollapsibleSection>
  );
}

function Jump({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-sand/20 hover:border-blaze hover:text-blaze focus-visible:ring-blaze tabular rounded border px-1.5 py-0.5 text-[0.6875rem] transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      show {label}
    </button>
  );
}
