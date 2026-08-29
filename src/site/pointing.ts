/**
 * What picking a segment is called on this machine, and what it is done with.
 *
 * The one instruction a first-time rider is given should name the gesture they
 * actually have. Decided by whether the pointer can hover rather than by screen
 * width, because it is the input being described and not the layout — a small
 * window on a laptop is still a mouse.
 *
 * Apart from the component that reads it so that the panels can too: a module
 * exporting both a component and a constant is a module fast refresh gives up
 * on, and both panels open with a sentence built out of this.
 */
export const POINTING =
  typeof window !== "undefined" &&
  window.matchMedia?.("(hover: hover)").matches;

export const PICK = POINTING ? "Click" : "Tap";
