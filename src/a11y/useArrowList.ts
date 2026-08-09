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
 *   - Every navigation keypress speaks the item at the resulting position,
 *     including presses that hit a boundary and don't move — silence there
 *     is indistinguishable from a dropped keystroke
 *   - Readouts go to the `navigation` channel, which interrupts. Sharing the
 *     polite channel with scene narration meant a screen reader queued them
 *     and quick arrowing only ever spoke the first and last item
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
  // Bumped by every navigation keypress. The announce effect keys off this
  // rather than off `index` so a press that clamps at an end still speaks.
  const [tick, setTick] = useState(0);

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
  const describeRef = useRef(describe);
  describeRef.current = describe;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      // Modal open: don't steal keys from or announce over the dialog.
      if (isModalOpen()) return;
      const len = itemsRef.current.length;
      if (len === 0) return;
      let moved = true;
      if (e.key === "ArrowDown") {
        setIndex((i) => Math.min((i < 0 ? -1 : i) + 1, len - 1));
      } else if (e.key === "ArrowUp") {
        setIndex((i) => Math.max((i < 0 ? len : i) - 1, 0));
      } else if (e.key === "Home") {
        setIndex(0);
      } else if (e.key === "End") {
        setIndex(len - 1);
      } else if (e.key === "Enter") {
        const idx = indexRef.current;
        if (idx >= 0 && idx < len && onActivateRef.current) {
          e.preventDefault();
          onActivateRef.current(itemsRef.current[idx], idx);
        }
        return;
      } else {
        moved = false;
      }
      if (moved) {
        e.preventDefault();
        setTick((t) => t + 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  useEffect(() => {
    if (tick === 0) return; // mount / list reset: the scene narrates itself
    const len = itemsRef.current.length;
    if (index < 0 || index >= len) return;
    announcer.announce(
      `${describeRef.current(itemsRef.current[index], index)} ${index + 1} of ${len}.`,
      "navigation"
    );
    // `index` is intentionally not a dependency on its own: the tick is what
    // marks "the user pressed a key", and index is always current in the same
    // commit because both state updates are batched together.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  return { index, focused: index >= 0 && index < items.length ? items[index] : null };
}
