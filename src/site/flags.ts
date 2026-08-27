/**
 * Things that are built but not switched on.
 *
 * Read from the environment rather than hard-coded so that turning one on is a
 * variable rather than a commit, and so an off flag folds away at build time —
 * `import.meta.env` is substituted before minification, which means a false
 * flag takes the branch, the component, and everything only it imports out of
 * the bundle entirely.
 */

/**
 * List the roads that can be picked next, in words, beside the map.
 *
 * Off by default. It exists because roads are drawn on a canvas, which cannot
 * be tabbed to or read aloud, so without it a rider who is not pointing at the
 * map has no way to build a route at all. It is off because this is a map
 * first: anyone using it is almost certainly looking at one, and a standing
 * list of eight roads is a large, permanent cost to the panel for a case that
 * the map itself already serves better.
 *
 * Everything else from the same pass — what gets announced when a road is
 * picked, focus rings, targets sized for a thumb, honouring reduced motion —
 * is unconditional. This is the one piece that changes what the panel looks
 * like for everybody.
 */
export const SHOW_TURNINGS = import.meta.env.VITE_TURNINGS === "true";
