import { useEffect, useRef, useState } from "react";
import type { AnnouncementQueue } from "./AnnouncementQueue";
import { isModalOpen } from "./modality";

/**
 * 2-D arrow navigation for scenes laid out as a grid of cells (columnar
 * Extended Forecast, Hourly, Travel Cities table, etc.). Left/right walks
 * columns; up/down walks rows. Home/End jump to row ends; PageUp/PageDown
 * jump rows.
 *
 * Accepts items as a flat array plus a `columns` count — index math handles
 * 2-D movement. For a single-row layout (columns = items.length) left/right
 * walks every cell and up/down is a no-op, which is exactly right for a
 * 7-day row of forecast columns.
 *
 * Like useArrowList, every navigation keypress speaks — including one that
 * clamps at an edge — and readouts go to the interrupting `navigation`
 * channel so quick arrowing doesn't queue up behind scene narration.
 */
export function useArrowGrid<T>(
  items: T[],
  columns: number,
  describe: (item: T, index: number) => string,
  announcer: AnnouncementQueue,
  enabled: boolean = true,
): { index: number; focused: T | null } {
  const [index, setIndex] = useState(-1);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setIndex(-1);
  }, [items.length]);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;
  const describeRef = useRef(describe);
  describeRef.current = describe;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      // Modal open: the scene underneath stays mounted, but its arrows must
      // not steal keys from (or announce over) the dialog's controls.
      if (isModalOpen()) return;
      const len = itemsRef.current.length;
      const cols = Math.max(1, columnsRef.current);
      if (len === 0) return;
      const rows = Math.ceil(len / cols);
      let moved = true;

      if (e.key === "ArrowRight") {
        setIndex((i) => {
          if (i < 0) return 0;
          const row = Math.floor(i / cols);
          const col = i % cols;
          const nextCol = Math.min(col + 1, Math.min(cols - 1, len - row * cols - 1));
          return row * cols + nextCol;
        });
      } else if (e.key === "ArrowLeft") {
        setIndex((i) => {
          if (i < 0) return 0;
          const row = Math.floor(i / cols);
          const col = i % cols;
          return row * cols + Math.max(col - 1, 0);
        });
      } else if (e.key === "ArrowDown" || e.key === "PageDown") {
        setIndex((i) => {
          if (i < 0) return 0;
          const next = i + cols;
          return next < len ? next : Math.min(len - 1, (rows - 1) * cols + (i % cols));
        });
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        setIndex((i) => {
          if (i < 0) return 0;
          const next = i - cols;
          return next >= 0 ? next : i % cols;
        });
      } else if (e.key === "Home") {
        setIndex((i) => (i < 0 ? 0 : Math.floor(i / cols) * cols));
      } else if (e.key === "End") {
        setIndex((i) => {
          if (i < 0) return Math.min(cols - 1, len - 1);
          const row = Math.floor(i / cols);
          return Math.min((row + 1) * cols - 1, len - 1);
        });
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
    if (tick === 0) return;
    const len = itemsRef.current.length;
    if (index < 0 || index >= len) return;
    announcer.announce(
      `${describeRef.current(itemsRef.current[index], index)} ${index + 1} of ${len}.`,
      "navigation"
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);

  return { index, focused: index >= 0 && index < items.length ? items[index] : null };
}
