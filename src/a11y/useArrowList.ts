import { useEffect, useRef, useState } from "react";
import type { AnnouncementQueue } from "./AnnouncementQueue";
import { isModalOpen } from "./modality";

/**
 * Generic up/down arrow navigation for a list of items inside a scene view.
 * Each scene exposes its content as a flat array (forecast periods, hours,
 * cells, alerts) and gets per-scene arrow navigation for free.
 *
 * Behavior:
 *   - Up / Down move the focus index, clamped to range
 *   - Home / End jump to ends
 *   - On focus change, the announcer speaks the described item
 *   - Resets to -1 (nothing focused) on item-list change so a freshly
 *     mounted scene starts in "no item focused, reading the whole scene"
 *     state — the scene's own narration runs first, then the user can drill in.
 */
export function useArrowList<T>(
  items: T[],
  describe: (item: T, index: number) => string,
  announcer: AnnouncementQueue,
  enabled: boolean = true,
  onActivate?: (item: T, index: number) => void
): { index: number; focused: T | null } {
  const [index, setIndex] = useState(-1);

  // Reset focus only when the item COUNT changes (e.g., scene swap produced a
  // different-length list). Depending on the items array reference would reset
  // on every render because callers build the array inline.
  useEffect(() => {
    setIndex(-1);
  }, [items.length]);

  // Keep live refs so the key handler always reads current values without
  // needing to re-subscribe on every render.
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onActivateRef = useRef(onActivate);
  onActivateRef.current = onActivate;
  const indexRef = useRef(index);
  indexRef.current = index;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      // Modal open: don't steal keys from or announce over the dialog.
      if (isModalOpen()) return;
      const len = itemsRef.current.length;
      if (len === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => Math.min((i < 0 ? -1 : i) + 1, len - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => Math.max((i < 0 ? len : i) - 1, 0));
      } else if (e.key === "Home") {
        e.preventDefault();
        setIndex(0);
      } else if (e.key === "End") {
        e.preventDefault();
        setIndex(len - 1);
      } else if (e.key === "Enter") {
        const idx = indexRef.current;
        if (idx >= 0 && idx < len && onActivateRef.current) {
          e.preventDefault();
          onActivateRef.current(itemsRef.current[idx], idx);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  useEffect(() => {
    if (index < 0 || index >= itemsRef.current.length) return;
    void announcer.announce(describe(itemsRef.current[index], index), "polite");
    // describe is intentionally excluded from deps — callers usually inline it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  return { index, focused: index >= 0 && index < items.length ? items[index] : null };
}
