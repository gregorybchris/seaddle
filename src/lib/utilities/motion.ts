/**
 * Whether this reader has asked for things to stop moving.
 *
 * The stylesheet already neutralises every CSS animation and transition, which
 * covers the panel. It cannot reach the map: a camera flight is a library
 * animating its own canvas from JavaScript, and 700ms of the city sliding
 * under someone is exactly the motion the setting is about.
 *
 * Read at the moment of the animation rather than held in state, so a reader
 * who changes the setting mid-session is obeyed on the very next move.
 */
export function prefersReducedMotion(): boolean {
  return Boolean(
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
  );
}
