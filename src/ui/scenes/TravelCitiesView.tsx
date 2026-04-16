import type { TravelCitiesData, TravelCity } from "../../core/scenes/scenes/TravelCitiesScene";
import { useArrowGrid } from "../../a11y/useArrowGrid";
import { useAnnouncer } from "../../a11y/AnnouncerContext";
import { WeatherIcon, chooseIcon } from "../weatherscan/WeatherIcon";

/**
 * Era-authentic Travel Cities — table of cities with an icon column, temp
 * column, conditions column. Matches the TWC Travel Cities presentation
 * used from WSXL onward: city name on the left, small weather icon, high
 * temp, short conditions. Left/right walks columns within a row; up/down
 * walks between cities.
 */
export function TravelCitiesView({ data }: { data: TravelCitiesData }) {
  const { place, cities } = data;
  const announcer = useAnnouncer();

  // 3 cells per city row: name | temp+icon | conditions.
  type Cell = { city: TravelCity; kind: "name" | "temp" | "cond" };
  const cells: Cell[] = [];
  for (const c of cities) {
    cells.push({ city: c, kind: "name" });
    cells.push({ city: c, kind: "temp" });
    cells.push({ city: c, kind: "cond" });
  }

  const { index } = useArrowGrid(
    cells,
    3,
    (c) => describe(c),
    announcer,
  );

  if (cities.length === 0) {
    return (
      <section aria-label={`Travel cities for ${place.name}`}>
        <p style={{ color: "var(--ws-text-dim)" }}>
          No travel cities configured. Press M to add favorites.
        </p>
      </section>
    );
  }

  return (
    <section aria-label={`Travel cities for ${place.name}`} className="ws-travel">
      <p className="ws-extended-hint">
        Left and right arrows walk columns, up and down walk between cities.
      </p>
      <div className="ws-travel-grid" role="table" aria-label="Travel cities">
        <div className="ws-travel-header" role="row">
          <div role="columnheader">City</div>
          <div role="columnheader">Temperature</div>
          <div role="columnheader">Conditions</div>
        </div>
        {cities.map((city, rowIdx) => {
          const iconName = chooseIcon(city.condition ?? null, true);
          const baseIdx = rowIdx * 3;
          return (
            <div
              className="ws-travel-row"
              role="row"
              key={`${city.name}-${city.state}`}
            >
              <div
                role="cell"
                className="ws-travel-cell ws-travel-name"
                data-focused={index === baseIdx}
                aria-current={index === baseIdx ? "true" : undefined}
              >
                <span className="ws-travel-city">{city.name}</span>
                <span className="ws-travel-state">{city.state}</span>
              </div>
              <div
                role="cell"
                className="ws-travel-cell ws-travel-temp"
                data-focused={index === baseIdx + 1}
                aria-current={index === baseIdx + 1 ? "true" : undefined}
              >
                <WeatherIcon name={iconName} size={40} />
                <span className="ws-travel-deg">
                  {city.tempF != null ? `${city.tempF}°` : "—"}
                </span>
              </div>
              <div
                role="cell"
                className="ws-travel-cell ws-travel-cond"
                data-focused={index === baseIdx + 2}
                aria-current={index === baseIdx + 2 ? "true" : undefined}
              >
                {city.condition ?? "—"}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function describe(c: { city: TravelCity; kind: "name" | "temp" | "cond" }): string {
  const temp = c.city.tempF != null ? `${c.city.tempF} degrees` : "temperature unavailable";
  const cond = c.city.condition ?? "conditions unavailable";
  switch (c.kind) {
    case "name": return `${c.city.name}, ${c.city.state}.`;
    case "temp": return `${c.city.name}: ${temp}.`;
    case "cond": return `${c.city.name}: ${cond}.`;
  }
}
