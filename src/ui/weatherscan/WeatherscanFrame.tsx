import { useEffect, useState, type ReactNode } from "react";
import { LdlCrawl } from "./LdlCrawl";
import type { FaaClient } from "../../core/weather/FaaClient";

interface Props {
  sceneTitle: string;
  alertCount: number;
  children: ReactNode;
  statusHint?: string;
  /** True during a severe-weather interrupt — triggers the orange visual takeover. */
  severeInterrupt?: boolean;
  /** Scrolling ticker text (alert headlines), shown at the bottom during interrupts. */
  tickerText?: string;
  /** Active theme id — drives theme-specific chrome (e.g. IS2 LDL crawl). */
  themeId?: string;
  /** FAA client wired into the IS2 Lower Display Line crawl. */
  faa?: FaaClient;
  /** Condition key for the current observation — drives the small weather
   *  icon shown next to the LDL section label. */
  ldlIconName?: string;
  /**
   * The Weatherscan V2 left column, when the active machine declares one.
   * Passing it switches the frame from a vertical flex flow to the measured
   * 224/496 grid; omitting it leaves every other machine exactly as it was.
   */
  lbar?: ReactNode;
  /**
   * The WeatherStar 4000 v2 always-on footer bar, when the active machine
   * declares one. Takes the bottom slot, so it replaces the hotkey status bar
   * the way the LDL crawl does on the machines that ran one.
   */
  footer?: ReactNode;
  /**
   * Wrap the scene in the IntelliStar 2 LOT8s window instead of letting it
   * fill the stage. Given a function so the frame stays ignorant of what the
   * wrapper is — it hands over the children and gets a tree back.
   */
  windowed?: (scene: ReactNode) => ReactNode;
  /**
   * Which header treatment to paint. The WeatherStar 4000 v2 ran a
   * pink/magenta parallelogram on the radar and orange everywhere else, and
   * the pink one is taller because it carries the PRECIP ramp.
   */
  headerVariant?: "radar";
  /** Extra chrome inside the header band — the PRECIP ramp lives here. */
  headerExtra?: ReactNode;
  /**
   * The Weatherscan city ticker for the bottom strip. Ranks below a severe
   * crawl and above the LDL: the real V2 ran the ticker as its default
   * bottom content, and an emergency has to be able to take the slot.
   */
  cityTicker?: ReactNode;
}

/**
 * The decorative outer frame: header with clock, alert banner if any,
 * stage area for the current scene, the corner bug, and a bottom status
 * bar with hotkey hints.
 *
 * The whole stage carries role="application" so NVDA stays in focus mode
 * automatically and arrow keys reach our handlers without the user having
 * to manually toggle browse/focus mode each session.
 *
 * Decorative elements (clock, bug, alert banner emoji) are aria-hidden —
 * the announcer is the source of truth for assistive tech.
 */
export function WeatherscanFrame({ sceneTitle, alertCount, children, statusHint, severeInterrupt, tickerText, themeId, faa, ldlIconName, lbar, footer, windowed, headerVariant, headerExtra, cityTicker }: Props) {
  // LDL (Lower Display Line) crawl — shown on every TWC era that historically ran a
  // persistent bottom crawl: Weatherscan (1999+), WeatherStar XL (post-2005),
  // IntelliStar 1 (2003+), and IntelliStar 2 HD / Jr HD (2013+). WS4000-era
  // themes keep the hotkey status bar instead — no persistent crawl on those.
  const LDL_THEMES = new Set([
    "weatherscan-local", "weatherscan-v1", "weatherscan-v2",
    "weatherstarxl", "intellistar1", "intellistar2",
  ]);
  const showLdl = !!themeId && LDL_THEMES.has(themeId) && !!faa && !severeInterrupt;
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });

  // Era logos — rendered unconditionally; CSS hides them on themes where
  // they're not era-authentic. Marked aria-hidden since the header <h1>
  // already carries the semantic brand for assistive tech.
  const twcLogoShown = !!themeId && [
    "weatherscan-local", "weatherscan-v1", "weatherscan-v2",
    "weatherstarxl", "intellistar1", "intellistar2",
  ].includes(themeId);
  const intellistarBugShown = !!themeId && ["intellistar1", "intellistar2"].includes(themeId);

  return (
    <div className={`ws-frame${severeInterrupt ? " ws-severe" : ""}${lbar ? " ws-lbar" : ""}${windowed ? " ws-windowed" : ""}`}>
      <header className="ws-header" data-variant={headerVariant}>
        {twcLogoShown && (
          <img
            className="ws-twc-logo"
            src="/assets/shared/logos/twc/TWC_Logo.png"
            alt=""
            aria-hidden="true"
          />
        )}
        <h1 className="ws-title">Accessible Weather Center</h1>
        {headerExtra}
        <div className="ws-clock" aria-hidden="true">{time}</div>
      </header>
      {alertCount > 0 && (
        <div className="ws-alert-banner" aria-hidden="true">
          {severeInterrupt ? "SEVERE WEATHER ALERT" : `${alertCount} active alert${alertCount === 1 ? "" : "s"}`}
        </div>
      )}
      <main
        className="ws-stage"
        role="application"
        aria-label={`${sceneTitle} screen. Tab or shift-tab to change scenes. Arrow keys navigate within this scene. Press question mark for help.`}
      >
        <h2 className="ws-scene-title">{sceneTitle}</h2>
        {windowed ? windowed(children) : children}
        {intellistarBugShown ? (
          <img
            className="ws-bug ws-bug-is"
            src="/assets/shared/logos/intellistar/IntelliStar_HQ.png"
            alt=""
            aria-hidden="true"
          />
        ) : (
          <div className="ws-bug" aria-hidden="true">AWC · LIVE</div>
        )}
      </main>
      {/* After the stage in the DOM, painted to its left by the grid. Browse
          mode should reach the scene before the persistent sidebar. */}
      {lbar}
      {severeInterrupt && tickerText ? (
        <div className="ws-ticker" role="region" aria-label="Severe weather alert crawl">
          <div className="ws-ticker-content" aria-hidden="true">{tickerText}</div>
          <ul className="sr-only">
            {tickerText.split("  ///  ").map((line, i) => <li key={i}>{line}</li>)}
          </ul>
        </div>
      ) : cityTicker ? (
        cityTicker
      ) : showLdl ? (
        <LdlCrawl faa={faa!} leadItems={[`${sceneTitle.toUpperCase()}`]} leadIconName={ldlIconName} />
      ) : footer ? (
        footer
      ) : (
        <div className="ws-status-bar" aria-hidden="true">
          <span>Tab scenes</span>
          <span>← → ↑ ↓ navigate</span>
          <span>M favorites</span>
          <span>N map nav</span>
          <span>Space pause</span>
          <span>, settings</span>
          <span>? help</span>
          <span>Esc silence</span>
          {statusHint && <span style={{ marginLeft: "auto", color: "var(--ws-accent-warm)" }}>{statusHint}</span>}
        </div>
      )}
    </div>
  );
}
