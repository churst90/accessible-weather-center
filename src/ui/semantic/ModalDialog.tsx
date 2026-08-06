import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { pushModal, popModal } from "../../a11y/modality";

interface Props {
  open: boolean;
  onClose: () => void;
  /** The `aria-labelledby` id on the dialog's heading. */
  labelledBy: string;
  children: ReactNode;
  /** Minimum width of the inner card. Default 480. */
  minWidth?: number;
  /** Opacity of the backdrop. Default 0.75. */
  backdropOpacity?: number;
}

/**
 * Accessible modal shell used by the Settings panel and Help dialog.
 *
 * Responsibilities:
 *   1. Render to a React Portal attached to document.body so the dialog is
 *      a DOM sibling of `#root`, not a descendant of the `role="application"`
 *      scene region. NVDA's dialog context switch relies on this — when a
 *      dialog opens inside an application region, the screen reader may
 *      not realize it needs to leave focus mode on the scene.
 *   2. Move keyboard focus into the dialog on open, then restore it to the
 *      previously-focused element on close. Without this, NVDA remains on
 *      the scene and pressing Enter/Tab talks to the scene, not the dialog.
 *   3. Mark `#root` inert while the dialog is open so background controls
 *      can't be Tab-reached or activated by assistive tech.
 *   4. Trap Tab / Shift+Tab within the dialog: Tab from the last focusable
 *      wraps to the first; Shift+Tab from the first wraps to the last.
 *   5. Handle Escape with capture + stopImmediatePropagation so the global
 *      KeyboardRouter doesn't ALSO fire its Escape handler and exit a
 *      Favorites / Map Nav view mode that happens to be active underneath.
 *
 * Callers render their own heading (with id === labelledBy) and form
 * controls as children. First interactive control gets initial focus.
 */
export function ModalDialog({
  open,
  onClose,
  labelledBy,
  children,
  minWidth = 480,
  backdropOpacity = 0.75,
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // Tell window-level key listeners (KeyboardRouter, arrow-nav hooks)
    // that a modal owns the keyboard — `inert` blocks focus but not their
    // window keydown handlers.
    pushModal();

    // Remember what was focused before the dialog opened so we can restore it.
    previousFocusRef.current = (document.activeElement as HTMLElement) ?? null;

    // Mark the main app inert so background controls aren't reachable by
    // Tab or screen-reader navigation while the dialog is open. `inert` is
    // supported natively in Chromium (Electron) without any polyfill.
    const root = document.getElementById("root");
    if (root) root.setAttribute("inert", "");

    // Move focus into the dialog. Prefer the first interactive control
    // (button, input, select, textarea, [tabindex]); fall back to the
    // dialog container itself with a programmatic tabindex of -1.
    const dialog = dialogRef.current;
    if (dialog) {
      const firstFocusable = dialog.querySelector<HTMLElement>(
        FOCUSABLE_SELECTOR
      );
      if (firstFocusable) {
        firstFocusable.focus();
      } else {
        dialog.tabIndex = -1;
        dialog.focus();
      }
    }

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
        return;
      }
      if (e.key === "Tab") {
        trapTab(e, dialog);
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });

    return () => {
      popModal();
      window.removeEventListener("keydown", onKey, { capture: true });
      if (root) root.removeAttribute("inert");
      const prev = previousFocusRef.current;
      if (prev && typeof prev.focus === "function") {
        try { prev.focus(); } catch { /* element may have been unmounted */ }
      }
      previousFocusRef.current = null;
    };
  }, [open, onClose]);

  if (!open) return null;

  const markup = (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      ref={dialogRef}
      style={{
        position: "fixed",
        inset: 0,
        background: `rgba(0,0,0,${backdropOpacity})`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        // Click on the backdrop (not the card) closes the dialog, matching
        // the behavior of most native modal implementations.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--ws-bg-mid)",
          border: "2px solid var(--ws-accent)",
          padding: "24px 32px",
          minWidth,
          maxHeight: "85vh",
          overflow: "auto",
          color: "var(--ws-text)",
        }}
      >
        {children}
      </div>
    </div>
  );

  return createPortal(markup, document.body);
}

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapTab(e: KeyboardEvent, dialog: HTMLDivElement | null): void {
  if (!dialog) return;
  const focusables = Array.from(
    dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null);
  if (focusables.length === 0) {
    e.preventDefault();
    return;
  }
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement as HTMLElement | null;

  if (e.shiftKey) {
    if (active === first || !dialog.contains(active)) {
      e.preventDefault();
      last.focus();
    }
  } else {
    if (active === last || !dialog.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  }
}
