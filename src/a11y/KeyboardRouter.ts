/**
 * Centralized keyboard shortcut registry. Components register intent (e.g.
 * "next scene") with a key spec; the router resolves what fires on a given
 * keydown. Centralizing this lets us:
 *   - Show one help dialog listing every shortcut.
 *   - Detect conflicts at registration time.
 *   - Cleanly disable shortcuts when a modal opens.
 */

export interface Shortcut {
  id: string;
  description: string;
  keys: string;
  group: string;
  handler: () => void;
}

export class KeyboardRouter {
  private shortcuts = new Map<string, Shortcut>();
  private enabled = true;

  register(s: Shortcut): () => void {
    const key = normalizeKeySpec(s.keys);
    if (this.shortcuts.has(key)) {
      throw new Error(`Keyboard conflict: '${s.keys}' already bound to ${this.shortcuts.get(key)!.id}`);
    }
    this.shortcuts.set(key, s);
    return () => {
      this.shortcuts.delete(key);
    };
  }

  list(): Shortcut[] {
    return [...this.shortcuts.values()];
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
  }

  attach(target: Window | HTMLElement = window): () => void {
    const onKey = (raw: Event) => {
      if (!this.enabled) return;
      const e = raw as KeyboardEvent;
      // When the user is typing in an editable field (ZIP input, settings
      // inputs, etc.), do not consume keystrokes. Only Escape bubbles
      // through so the user can still close modals.
      if (isEditable(e.target) && e.key !== "Escape") return;
      const spec = specFromEvent(e);
      const hit = this.shortcuts.get(spec);
      if (hit) {
        e.preventDefault();
        hit.handler();
      }
    };
    target.addEventListener("keydown", onKey);
    return () => target.removeEventListener("keydown", onKey);
  }
}

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if ((el as HTMLElement).isContentEditable) return true;
  return false;
}

function normalizeKeySpec(spec: string): string {
  return spec
    .toLowerCase()
    .split("+")
    .map((p) => p.trim())
    .sort((a, b) => weight(a) - weight(b))
    .join("+");
}

function weight(token: string): number {
  if (token === "ctrl") return 0;
  if (token === "alt") return 1;
  if (token === "shift") return 2;
  if (token === "meta") return 3;
  return 10;
}

function specFromEvent(e: KeyboardEvent): string {
  const parts: string[] = [];
  if (e.ctrlKey) parts.push("ctrl");
  if (e.altKey) parts.push("alt");
  if (e.shiftKey) parts.push("shift");
  if (e.metaKey) parts.push("meta");
  parts.push(e.key.length === 1 ? e.key.toLowerCase() : e.key.toLowerCase());
  return normalizeKeySpec(parts.join("+"));
}
