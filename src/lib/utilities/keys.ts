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
 * Whether this is the key a rider reaches for to take something back.
 *
 * Both spellings, because one key sends two of them: the key labelled "delete"
 * on a Mac laptop sends Backspace, and the one labelled "delete" on a full
 * keyboard sends Delete. Asking for Backspace alone left the bare rubout
 * answering on a laptop and silent on a desk, while the modified one beside it
 * — which had always tested for both — answered on either.
 *
 * One place, because the two bindings are the same key wearing a modifier, and
 * the settings dialog lists them under one cap.
 */
export function isRubout(event: KeyboardEvent): boolean {
  return event.key === "Backspace" || event.key === "Delete";
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
