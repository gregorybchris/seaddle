/**
 * The next free id for a prefix, e.g. `nextId("n", ["n001", "n004"])` → "n005".
 *
 * Ids are never reused, even after a delete. A geometry file or a stale segment
 * reference that outlives its owner should fail loudly rather than silently
 * attach itself to whatever got the number next.
 */
export function nextId(prefix: string, existing: string[]): string {
  let highest = 0;
  for (const id of existing) {
    if (!id.startsWith(prefix)) continue;
    const number = Number(id.slice(prefix.length));
    if (Number.isInteger(number) && number > highest) highest = number;
  }
  return `${prefix}${String(highest + 1).padStart(3, "0")}`;
}
