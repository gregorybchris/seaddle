/**
 * Turn a stored value into something readable: "protection" → "lane quality".
 *
 * Done by rule rather than by a table of labels, because a table only covers
 * the values someone remembered to add to it — and the one that leaked into the
 * interface was the one nobody had. Left lowercase, since these read as words
 * in a row of choices rather than as headings.
 */
export function humanize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
}
