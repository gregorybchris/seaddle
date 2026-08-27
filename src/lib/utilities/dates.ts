const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * A ride's date, short enough to sit in a list: "6 Jul 2026".
 *
 * Read in the reader's own timezone, because a ride at half past four in the
 * afternoon in Seattle is stamped the following day in UTC, and it happened on
 * the afternoon the rider remembers.
 */
export function formatRideDate(iso: string): string {
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return "";
  return `${when.getDate()} ${MONTHS[when.getMonth()]} ${when.getFullYear()}`;
}
