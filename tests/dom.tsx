/**
 * A DOM for the tests, and the smallest possible React renderer over it.
 *
 * Until this existed the suite could not touch a single component. Every UI
 * bug found in this project — scene views calling hooks after an early
 * return, arrow readouts landing on a channel the screen reader queued and
 * dropped, a grid cursor read from a stale render closure, an alert tone cut
 * off by the scene transition it triggered — was found by reading the code,
 * because nothing could drive it. That is a poor way to find bugs and a worse
 * way to keep them fixed.
 *
 * Deliberately not a testing library. `@testing-library/react` would bring a
 * dependency tree and its own opinions for what amounts to: make a container,
 * render into it, flush effects, read text. Four functions is the whole need.
 *
 * happy-dom rather than jsdom: it installs cleanly here, starts in
 * milliseconds, and implements everything these tests touch. It does NOT
 * implement layout — no element has a size, nothing is really visible — so
 * assert on structure, text and ARIA, never on geometry.
 */
import { Window } from "happy-dom";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

/**
 * Install a DOM onto globalThis.
 *
 * React reads `window`, `document` and a handful of globals at module scope,
 * so this has to run before any component is imported for the values to be
 * seen. Test files import this module first for that reason.
 */
function installDom(): void {
  if ((globalThis as { document?: unknown }).document) return;
  const win = new Window({ url: "https://awc.test/" });
  const g = globalThis as unknown as Record<string, unknown>;
  // Node defines some of these as getter-only on globalThis (navigator since
  // Node 21), so a plain assignment throws. defineProperty replaces the
  // descriptor outright and works for both the getter-only ones and the ones
  // that are simply absent.
  const set = (name: string, value: unknown) =>
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });

  set("window", win);
  set("document", win.document);
  set("navigator", win.navigator);
  g.HTMLElement = win.HTMLElement;
  g.Element = win.Element;
  g.Node = win.Node;
  g.Event = win.Event;
  g.KeyboardEvent = win.KeyboardEvent;
  g.CustomEvent = win.CustomEvent;
  g.getComputedStyle = win.getComputedStyle.bind(win);
  g.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(Date.now()), 0) as unknown as number;
  g.cancelAnimationFrame = (id: number) => clearTimeout(id);
  // React 18 checks for this to decide whether act() warnings apply.
  g.IS_REACT_ACT_ENVIRONMENT = true;
}
installDom();

export interface Mounted {
  /** The element the component rendered into. */
  container: HTMLElement;
  /** Re-render with new props, on the SAME instance — which is the point.
   *  A scene view that is reconciled rather than remounted is exactly where
   *  the conditional-hook crashes lived. */
  rerender(node: React.ReactElement): void;
  unmount(): void;
  /** Visible text with whitespace collapsed, for readable assertions. */
  text(): string;
}

/** Render a component and flush its effects. */
export function mount(node: React.ReactElement): Mounted {
  const container = document.createElement("div");
  document.body.appendChild(container);
  let root: Root;
  act(() => { root = createRoot(container); root.render(node); });
  return {
    container,
    rerender(next) { act(() => { root.render(next); }); },
    unmount() { act(() => { root.unmount(); }); container.remove(); },
    text() { return (container.textContent ?? "").replace(/\s+/g, " ").trim(); },
  };
}

/**
 * Dispatch a keydown on `window`, where every handler in this app listens.
 *
 * The arrow-navigation hooks and the map-nav mode all attach to window rather
 * than to a focused element, so a synthetic React event would miss them
 * entirely and the test would pass by not exercising anything.
 */
export function pressKey(key: string, init: Partial<KeyboardEventInit> = {}): void {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init }));
  });
}

/** Let queued effects, microtasks and zero-delay timers settle. */
export async function settle(): Promise<void> {
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
}

export { act, React };
