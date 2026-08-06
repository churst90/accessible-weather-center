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
      <button onClick={onClose} style={{ padding: "8px 16px", marginTop: 8 }}>
        Close (Esc)
      </button>
    </ModalDialog>
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
