import { useEffect, useRef, useState } from "react";
import type { AnnouncementQueue } from "./AnnouncementQueue";

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
 */
export function useArrowGrid<T>(
  items: T[],
  columns: number,
  describe: (item: T, index: number) => string,
  announcer: AnnouncementQueue,
  enabled: boolean = true,
): { index: number; focused: T | null } {
  const [index, setIndex] = useState(-1);

  useEffect(() => {
    setIndex(-1);
  }, [items.length]);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const len = itemsRef.current.length;
      const cols = Math.max(1, columnsRef.current);
      if (len === 0) return;
      const rows = Math.ceil(len / cols);

      if (e.key === "ArrowRight") {
        e.preventDefault();
        setIndex((i) => {
          if (i < 0) return 0;
          const row = Math.floor(i / cols);
          const col = i % cols;
          const nextCol = Math.min(col + 1, Math.min(cols - 1, len - row * cols - 1));
          return row * cols + nextCol;
        });
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setIndex((i) => {
          if (i < 0) return 0;
          const row = Math.floor(i / cols);
          const col = i % cols;
          return row * cols + Math.max(col - 1, 0);
        });
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setIndex((i) => {
          if (i < 0) return 0;
          const next = i + cols;
          return next < len ? next : Math.min(len - 1, (rows - 1) * cols + (i % cols));
        });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => {
          if (i < 0) return 0;
          const next = i - cols;
          return next >= 0 ? next : i % cols;
        });
      } else if (e.key === "Home") {
        e.preventDefault();
        setIndex((i) => (i < 0 ? 0 : Math.floor(i / cols) * cols));
      } else if (e.key === "End") {
        e.preventDefault();
        setIndex((i) => {
          if (i < 0) return Math.min(cols - 1, len - 1);
          const row = Math.floor(i / cols);
          return Math.min((row + 1) * cols - 1, len - 1);
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  useEffect(() => {
    if (index < 0 || index >= itemsRef.current.length) return;
    void announcer.announce(describe(itemsRef.current[index], index), "polite");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  return { index, focused: index >= 0 && index < items.length ? items[index] : null };
}
