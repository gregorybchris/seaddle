/**
 * Whether a keystroke belongs to a text field rather than to the page.
 *
 * Single-letter and bare-modifier shortcuts have to stand aside while someone
 * is typing a name, or the shortcut eats the letter.
 */
export function typingIn(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement
  );
}

/**
 * Whether this is a Mac, which names two of these keys differently to
 * everywhere else — and draws the modifier as a mark rather than a word.
 *
 * `navigator.platform` is deprecated and still the only thing every browser
 * agrees on; getting it wrong costs a tooltip the wrong symbol, which is why a
 * sniff is tolerable here and would not be anywhere else.
 */
export const IS_MAC =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * The modifier as a tooltip spells it.
 *
 * A tooltip is drawn by the operating system in a face of its own choosing, so
 * ⌘ is safe there in a way it is not on the page — nothing this site loads
 * draws that character. Anywhere in the document, spell the keys.
 */
export const MOD = IS_MAC ? "\u2318" : "Ctrl+";
