import type { KeyboardRouter, Shortcut } from "../../a11y/KeyboardRouter";
import { ModalDialog } from "./ModalDialog";

interface Props {
  router: KeyboardRouter;
  open: boolean;
  onClose: () => void;
}

/**
 * Modal listing every keyboard shortcut, grouped. Reachable via the `?`
 * shortcut or the help button. Focus, Escape, Tab trap, portal, and
 * background inert live in ModalDialog.
 */
export function HelpDialog({ router, open, onClose }: Props) {
  const groups = open ? groupBy(router.list(), (s) => s.group) : {};
  return (
    <ModalDialog open={open} onClose={onClose} labelledBy="awc-help-title" minWidth={520}>
      <h2 id="awc-help-title" style={{ marginTop: 0 }}>Keyboard shortcuts</h2>
      <p style={{ color: "var(--ws-text-dim)", marginTop: 0 }}>
        All keys below are global — you don't need to focus a specific element. If arrow
        keys don't move anything, your screen reader is in browse mode and is consuming
        them: switch to focus mode (NVDA and JAWS: Insert+Space) and they'll reach the app.
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
      <KeyTable
        title="Inside a scene"
        rows={[
          ["Up / Down", "Walk the current scene's readings one at a time"],
          ["Left / Right", "Walk columns on scenes laid out as a grid (forecast days, hours)"],
          ["Home / End", "First / last item in the row"],
          ["Page Up / Page Down", "Jump a row at a time on grid scenes"],
          ["Enter", "Full detail for the focused item, where the scene offers one"]
        ]}
      />
      <KeyTable
        title="Inside Favorites (M)"
        rows={[
          ["Up / Down", "Walk saved places; each announces its current conditions"],
          ["Home / End", "First / last place"],
          ["Enter", "Make the focused place your home location"],
          ["Z", "Add a place by ZIP code"],
          ["Delete", "Remove the focused place"],
          ["Escape or M", "Return to scenes"]
        ]}
      />
      <KeyTable
        title="Inside Map Navigation (N)"
        rows={[
          ["Tab / Shift+Tab", "Switch mode: Storms, Alerts, Grid Explorer"],
          ["Up / Down", "Walk storms or alerts"],
          ["Arrows", "Grid Explorer: move the cursor across the map"],
          ["Home / End", "First / last storm or alert"],
          ["[ and ]", "Grid Explorer: smaller / larger step (1, 3, 5, 10, 25 miles)"],
          ["Home", "Grid Explorer: jump back to your location"],
          ["Enter", "Full detail for the current storm, alert, or grid position"],
          ["Escape or N", "Return to scenes"]
        ]}
      />
      <button onClick={onClose} style={{ padding: "8px 16px", marginTop: 8 }}>
        Close (Esc)
      </button>
    </ModalDialog>
  );
}

/** A section of keys the KeyboardRouter doesn't know about — the mode- and
 *  scene-local ones handled by their own window listeners. */
function KeyTable({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 8, color: "var(--ws-accent)" }}>{title}</h3>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {rows.map(([k, d]) => (
          <li
            key={k}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "6px 0",
              borderBottom: "1px solid rgba(255,255,255,0.1)"
            }}
          >
            <span style={{ fontFamily: "var(--ws-font-led)", color: "var(--ws-led)" }}>{k}</span>
            <span>{d}</span>
          </li>
        ))}
      </ul>
    </section>
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
