import type { LocalForecastData } from "../../core/scenes/scenes/LocalForecastScene";
import { useArrowList } from "../../a11y/useArrowList";
import { useAnnouncer } from "../../a11y/AnnouncerContext";

/**
 * Era-authentic Local Forecast — large-text narrative panel showing one
 * period at a time. Mimics the TWC Local on the 8s "Local Forecast"
 * presentation that filled the screen with the period name and a big
 * paragraph of the detailed forecast. Up/down walks through periods.
 */
export function LocalForecastView({ data }: { data: LocalForecastData }) {
  const { place, periods } = data;
  const announcer = useAnnouncer();

  const { index } = useArrowList(
    periods,
    (p) => `${p.name}: ${p.detailedForecast}`,
    announcer,
  );

  if (periods.length === 0) {
    return <p>Local forecast for {place.name} is not available.</p>;
  }

  // Anchor on currently focused period; default to first.
  const active = periods[Math.max(0, index)];

  return (
    <section aria-label={`Local forecast for ${place.name}`} className="ws-narrative">
      <div className="ws-narrative-period" aria-live="off">
        {active.name}
      </div>
      <p
        className="ws-narrative-temp"
        aria-label={`${active.isDaytime ? "High" : "Low"} ${active.temperatureF} degrees`}
      >
        {active.isDaytime ? "HIGH" : "LOW"} {active.temperatureF}°
      </p>
      <p className="ws-narrative-text">{active.detailedForecast}</p>
      <p className="ws-narrative-pager" aria-hidden="true">
        Period {Math.max(0, index) + 1} of {periods.length} · ↑ ↓ to walk
      </p>
    </section>
  );
}
