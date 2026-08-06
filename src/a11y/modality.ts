/**
 * One shared answer to "does a modal currently own the keyboard?".
 *
 * ModalDialog sets `inert` on the app root, which blocks focus — but NOT
 * window-level keydown listeners. The KeyboardRouter and the arrow-nav
 * hooks all listen on window, so without this gate, arrows pressed inside
 * a Settings <select> were preventDefault-ed by the scene's grid hook and
 * announced cells from behind the dialog, and bare-letter shortcuts fired
 * while focus sat on a modal button.
 *
 * Modals push on open and pop on close; everything with a window-level
 * key listener checks isModalOpen() first. (Escape is unaffected: the
 * modal consumes it itself in capture phase.)
 */

let modalCount = 0;

export function pushModal(): void {
  modalCount++;
}

export function popModal(): void {
  modalCount = Math.max(0, modalCount - 1);
}

export function isModalOpen(): boolean {
  return modalCount > 0;
}

/** Test hook — not for app code. */
export function resetModality(): void {
  modalCount = 0;
}
