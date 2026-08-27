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
