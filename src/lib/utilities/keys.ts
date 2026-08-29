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
 * What the modifier key is called on this machine, for anything that shows a
 * shortcut rather than answers one.
 *
 * `navigator.platform` is deprecated and still the only thing every browser
 * agrees on; getting it wrong costs a tooltip the wrong symbol, which is why
 * a sniff is tolerable here and would not be anywhere else.
 */
export const MOD =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform)
    ? "\u2318"
    : "Ctrl+";
