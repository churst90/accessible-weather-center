import { useEffect } from "react";
import type { KeyboardRouter, Shortcut } from "../../a11y/KeyboardRouter";

interface Props {
  router: KeyboardRouter;
  open: boolean;
  onClose: () => void;
}

/**
 * Visible modal listing every keyboard shortcut, grouped. Reachable via
 * the `?` shortcut or the help button. Esc closes. The autoFocus button
 * gives the screen reader an immediate landing point.
 */
export function HelpDialog({ router, open, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [open, onClose]);

  if (!open) return null;
  const groups = groupBy(router.list(), (s) => s.group);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="awc-help-title"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000
      }}
    >
      <div
        style={{
          background: "var(--ws-bg-mid)",
          border: "2px solid var(--ws-accent)",
          padding: "24px 32px",
          minWidth: 520,
          maxHeight: "85vh",
          overflow: "auto",
          color: "var(--ws-text)"
        }}
      >
        <h2 id="awc-help-title" style={{ marginTop: 0 }}>Keyboard shortcuts</h2>
        <p style={{ color: "var(--ws-text-dim)", marginTop: 0 }}>
          The application stays in screen-reader focus mode automatically. All keys below
          are global — you don't need to focus a specific element.
        </p>
        {Object.entries(groups).map(([group, items]) => (
          <section key={group} style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 8, color: "var(--ws-accent)" }}>{group}</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {items.map((s) => (
                <li
                  key={s.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "6px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.1)"
                  }}
                >
                  <span style={{ fontFamily: "var(--ws-font-led)", color: "var(--ws-led)" }}>
                    {prettyKey(s.keys)}
                  </span>
                  <span>{s.description}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <button autoFocus onClick={onClose} style={{ padding: "8px 16px", marginTop: 8 }}>
          Close (Esc)
        </button>
      </div>
    </div>
  );
}

function groupBy<T>(items: T[], key: (t: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item);
    if (!out[k]) out[k] = [];
    out[k].push(item);
  }
  return out;
}

function prettyKey(keys: string): string {
  if (keys === " ") return "Space";
  if (keys === ",") return ",";
  return keys
    .split("+")
    .map((p) => (p.length === 1 ? p.toUpperCase() : p[0].toUpperCase() + p.slice(1)))
    .join(" + ");
}

export type { Shortcut };
