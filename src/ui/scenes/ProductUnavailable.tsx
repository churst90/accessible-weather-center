import { useEffect } from "react";
import { useAnnouncer } from "../../a11y/AnnouncerContext";

interface Props {
  /** Product the user was looking at. */
  title: string;
  /** The machine now selected. */
  deviceLabel: string;
  /** Why this hardware never had it. */
  reason: string | null;
}

/**
 * "This unit didn't have that."
 *
 * Shown when the active machine has no such product — switching from a
 * WeatherStar 4000 to a 3000 while sitting on the radar screen, say. The
 * alternative would be showing a 2020s radar page on 1988 hardware, which
 * defeats the point of emulating it.
 *
 * Typography and palette come from the theme's CSS custom properties, so
 * this renders in whatever typeface the selected unit used — the message is
 * as period-correct as the screens around it.
 *
 * Announced assertively because a scene changing to "nothing here" is
 * exactly the kind of silent state a screen-reader user would otherwise have
 * to infer from the absence of speech.
 */
export function ProductUnavailable({ title, deviceLabel, reason }: Props) {
  const announcer = useAnnouncer();

  useEffect(() => {
    void announcer?.announce(
      `${title} is not available on the ${deviceLabel}. ${reason ?? ""}`.trim(),
      "assertive"
    );
  }, [announcer, title, deviceLabel, reason]);

  return (
    <section
      aria-label={`${title} unavailable`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
        textAlign: "center",
        padding: "0 10%",
        fontFamily: "var(--ws-font-display)",
        color: "var(--ws-text)"
      }}
    >
      <div
        style={{
          fontFamily: "var(--ws-font-led)",
          fontSize: "2.2rem",
          color: "var(--ws-accent-warm)",
          marginBottom: 16,
          letterSpacing: "0.04em"
        }}
      >
        {title.toUpperCase()}
      </div>
      <p style={{ fontSize: "1.3rem", margin: 0 }}>
        Not available on the {deviceLabel}.
      </p>
      {reason ? (
        <p
          style={{
            fontFamily: "var(--ws-font-small)",
            fontSize: "1rem",
            color: "var(--ws-text-dim)",
            marginTop: 12,
            maxWidth: "44ch"
          }}
        >
          {reason}
        </p>
      ) : null}
      <p
        style={{
          fontFamily: "var(--ws-font-small)",
          fontSize: "0.95rem",
          color: "var(--ws-text-dim)",
          marginTop: 24
        }}
      >
        Press Tab for the next screen, or comma to choose another unit.
      </p>
    </section>
  );
}
