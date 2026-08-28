import { Mountains, Shield, Tree, type Icon } from "@phosphor-icons/react";
import { formatFeet, formatMiles } from "@/lib/utilities/units";
import { humanize } from "@/lib/utilities/words";
import { Badge } from "@/widgets/badge";
import { ElevationProfile } from "@/widgets/elevation-profile";
import { SeaddleMark } from "@/widgets/seaddle-mark";
import { Sheet } from "@/widgets/sheet";
import { TONES, type Attribute } from "../encoding";
import type { SiteSegment } from "../graph-data";
import { PICK } from "../pointing";
import { StartHere } from "./start-here";

type SegmentPanelProps = {
  /** The road being read, or nothing if the last click landed on the ground. */
  segment: SiteSegment | null;
  onScrub: (fraction: number | null) => void;
};

/**
 * What one road is like, for a rider who is not building anything yet.
 *
 * The same three attributes and two numbers the hover label gives on a desktop,
 * except that here they hold still — which is what makes them readable on a
 * phone, where there is no hover, and comparable between two roads, where a
 * label that vanishes on the way to the second one is no help at all.
 *
 * The chart is what the label could never carry. A road's steepness is one word
 * for the whole of it, and "rolling" covers both an even drag and a wall
 * followed by a descent; the profile is the only thing that tells them apart.
 */
export function SegmentPanel({ segment, onScrub }: SegmentPanelProps) {
  return (
    <Sheet
      label="This road"
      headerAt="desktop"
      // Low until a road is tapped, and then up to meet it.
      //
      // The opposite of the route panel, and for the same reason it stays down
      // over there: a pick while building is a change on the *map*, so rising
      // would cover the answer. Here the panel is the answer — tapping a road
      // is a request to read about it, and delivering that below the fold on a
      // phone is delivering nothing. What the map has to say about the road is
      // its casing and its two end marks, and both stay above the sheet.
      //
      // Putting it down again drops the panel back, so a rider tapping between
      // roads to compare them is not left holding half a screen of nothing.
      restingAt="peek"
      raisedWhen={segment !== null}
      raisedTo="half"
      header={
        <div className="flex items-center gap-3">
          <SeaddleMark className="text-sand h-8 w-8 shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-sand text-base leading-none tracking-[0.18em] uppercase">
              Seaddle
            </h1>
            <p className="eyebrow text-sand/70 mt-1">Seattle cycling routes</p>
          </div>
        </div>
      }
      /* Everything the hover label says, in the one slot that is visible at
         every resting height — so reading a road on a phone costs a tap and
         nothing else. The chart is below, because it is the part worth a drag
         and the part there is no room for here. */
      peek={
        segment ? (
          <Reading segment={segment} />
        ) : (
          <StartHere headline="Get to know a road">
            {PICK} any road to see what it is like.
          </StartHere>
        )
      }
    >
      <div className="flex flex-col gap-5">
        {/* Picking a road is a click on a canvas: nothing about it lands in the
            document, so without this the whole interaction is silent. */}
        <p role="status" aria-live="polite" className="sr-only">
          {segment ? spoken(segment) : ""}
        </p>

        {segment ? (
          // Chart and caption together, because the caption is about the
          // chart. Both are gone while the sheet is down, where all the chart
          // could show is its own top inch — and a sentence explaining a
          // picture that is not on screen is worse than either of them alone.
          <div className="flex flex-col gap-2 max-md:group-data-[collapsed]/sheet:hidden">
            {/* Keyed on the road, so the marker and the reading under the chart
                start again rather than carrying over from the last one. */}
            <ElevationProfile
              key={segment.id}
              points={segment.points}
              onScrub={onScrub}
            />
            {/* The chart is a road laid out left to right and the map is not,
                so this is the sentence that joins them. It names the two marks
                rather than describing a direction in words: a reader can look
                at a green dot, and cannot look at "the way it was recorded". */}
            <p className="text-sand/70 text-[0.8125rem] leading-relaxed">
              The chart runs from the green dot to the checkered flag. You can
              ride it either way.
            </p>
          </div>
        ) : (
          <HowExploringWorks />
        )}
      </div>
    </Sheet>
  );
}

/**
 * What the three stored words are called, and the mark that stands for each.
 *
 * A table, which everything else about these avoids: the legend and the color
 * picker read them through `humanize` precisely so there is no second list to
 * keep in step. It is worth one here because a bare "pleasant" is unreadable
 * to anyone who has not already met the scale it comes from — the value alone
 * says nothing about what was being judged — and because no rule turns an
 * attribute into an icon. Keyed on `Attribute`, so a fourth one cannot be
 * added to the map without this failing to compile.
 */
const ATTRIBUTES: { key: Attribute; label: string; Icon: Icon }[] = [
  { key: "steepness", label: "Steepness", Icon: Mountains },
  { key: "protection", label: "Protection", Icon: Shield },
  { key: "surroundings", label: "Surroundings", Icon: Tree },
];

/**
 * The road: what it is called, how big it is, and what it is like.
 *
 * The name leads and it leads at size, because in this mode the road is the
 * subject rather than a step in something else — everything under it is a
 * property of the thing the name has just introduced.
 *
 * Then the two numbers, small and on one line. They are the least of it here:
 * a rider reading a road they have not committed to is asking what it is like,
 * and the chart below says the same two things in more detail anyway.
 *
 * Then the three attributes, each named. They used to run together as
 * "flat · unprotected · plain", which reads as three adjectives about the same
 * thing rather than three answers to three different questions — and a
 * beginner has no way to work out which scale "plain" came off. So each gets
 * its category, and an icon to carry it once the label has been read the first
 * time. A description list, because that is what these are: the label is the
 * question and the value is the answer.
 *
 * They are also the largest thing here, name aside. This is the mode for
 * reading roads, and these three words are the reading.
 */
function Reading({ segment }: { segment: SiteSegment }) {
  return (
    <div className="border-sand/10 flex flex-col gap-2 border-t pt-3 max-md:border-t-0 max-md:pt-0">
      <div>
        <h2 className="text-sand truncate text-lg leading-tight md:text-xl">
          {segment.name ?? "Unnamed road"}
        </h2>
        <p className="tabular text-sand/70 text-xs md:text-sm">
          {formatMiles(segment.meters)} · ↑{formatFeet(climb(segment))}
        </p>
      </div>

      {/* Ruled like a spec sheet, because that is what it is. Three rows in the
          same three places every time is what lets a rider tap road after road
          and read only the words that changed — so the labels are set quiet and
          small and the answers are set large, and the eye can run straight down
          the right-hand column without reading a label twice.

          The answers are badged in the color of their verdict, so that column
          can be read without being read at all: three green pills is a road
          that suits a beginner, and the red one is the thing to look at.

          A step larger on a wide screen, where the sidebar is a full-height
          column with room to spare. On a phone it holds the smaller step, and
          goes entirely if the sheet is dragged back down over it — the panel
          comes up by itself when a road is tapped, so anyone putting it back is
          asking for the map, and three rows clipped off the bottom edge of the
          screen are worse than none. */}
      <dl className="border-sand/10 flex flex-col border-t max-md:group-data-[collapsed]/sheet:hidden">
        {ATTRIBUTES.map(({ key, label, Icon }) => (
          <div
            key={key}
            className="border-sand/10 flex items-center gap-2 border-b py-1.5 last:border-b-0 md:py-2.5"
          >
            <Icon
              aria-hidden
              weight="bold"
              className="text-sand/45 h-3.5 w-3.5 shrink-0 md:h-4 md:w-4"
            />
            <dt className="eyebrow text-sand/60">{label}</dt>
            <dd className="ml-auto">
              <Badge
                tone={TONES[key][segment[key]]}
                className="text-sm md:text-base"
              >
                {humanize(segment[key])}
              </Badge>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/**
 * What this mode is for, on the screen where nothing is selected yet.
 *
 * A rider who has just switched here from building has no reason to expect the
 * whole map to have gone live, and no reason to expect the shovel to bring
 * their half-built route back untouched. One line each, and no more: this sits
 * below the fold on a phone, so it has to reward a drag rather than be homework.
 */
const NOTES = [
  `Explore mode lets you view the attributes of individual segments. When you're ready to design a full route, ${PICK.toLocaleLowerCase()} the shovel to enter build mode.`,
];

function HowExploringWorks() {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="eyebrow text-sand/70">Explore mode</h2>
      <ul className="flex flex-col gap-1.5">
        {NOTES.map((note) => (
          <li
            key={note}
            className="text-sand/75 text-[0.8125rem] leading-relaxed"
          >
            {note}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * How much climbing this road holds.
 *
 * Undirected, like the steepness it agrees with: the bigger of the two climbs,
 * since a road being read has not been ridden in either direction yet and the
 * harder answer is the one worth planning around.
 */
function climb(segment: SiteSegment): number {
  return Math.max(segment.gainForward, segment.gainBackward);
}

/**
 * The same reading in a sentence, for whoever is not looking at the panel.
 *
 * Each value carries its category here too. Read aloud, three bare adjectives
 * in a row are worse than they are on screen: there are no columns to tell a
 * listener that they answer three different questions.
 */
function spoken(segment: SiteSegment): string {
  const attributes = ATTRIBUTES.map(
    ({ key, label }) => `${label} ${humanize(segment[key])}`,
  ).join(". ");
  return (
    `${segment.name ?? "Unnamed road"}. ` +
    `${formatMiles(segment.meters)}, ${formatFeet(climb(segment))} of climbing. ` +
    `${attributes}.`
  );
}
