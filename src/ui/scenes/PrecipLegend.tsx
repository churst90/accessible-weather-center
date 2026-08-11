/**
 * The WeatherStar 4000 v2 PRECIP legend.
 *
 * The 2005 radar redesign put a graded intensity ramp in the header, running
 * Light to Heavy, with a separate pink swatch for "Incomplete Data" — the
 * band the unit painted where it had no return at all, as distinct from where
 * it had a return of zero.
 *
 * MEASURED from `docs/reference/ws4000/WS4000_Simulator_v2_-_Local_Radar.jpg`.
 * Each colour below is the mean over the interior of its block (about 30x46
 * pixels), not a single sampled pixel, because the capture is a JPEG and
 * single pixels carry ringing from the black borders between blocks.
 *
 * THERE ARE EIGHT STEPS, NOT SEVEN. The device profile recorded "7-step
 * PRECIP legend" and that was wrong. The fourth block is very nearly black
 * (#071506), which reads like a JPEG artifact or a gap between swatches and
 * is neither: averaged across its whole interior it holds that value, and it
 * is the same width as its neighbours. A near-black step in the middle of a
 * green-to-red precipitation ramp is unusual enough to look like a bug, so it
 * is called out here and pinned by a test rather than quietly "corrected"
 * into a green by the next person to read this file.
 *
 * The ramp is decoration for a canvas that is itself aria-hidden — the storm
 * list beside it is what a screen reader reads, and it names intensities in
 * words. So the swatches are hidden and only the Light/Heavy sense of the
 * scale is exposed, which is the one thing the words do not convey.
 */

/** The eight ramp colours, light to heavy, as measured. */
export const PRECIP_RAMP = [
  "#33f339", // 1  bright green
  "#049431", // 2  green
  "#04460b", // 3  dark green
  "#071506", // 4  near-black — see the note above, this is real
  "#f1f304", // 5  yellow
  "#e9690b", // 6  orange
  "#c32804", // 7  red
  "#86300c", // 8  dark red
] as const;

/** The separate swatch for "no data", not part of the ramp. */
export const INCOMPLETE_DATA_COLOR = "#ffaaee";

export function PrecipLegend() {
  return (
    <div className="ws4000-precip" aria-label="Precipitation intensity scale, light to heavy">
      <span className="ws4000-precip-title" aria-hidden="true">PRECIP</span>
      <span className="ws4000-precip-end" aria-hidden="true">Light</span>
      <span className="ws4000-precip-ramp" aria-hidden="true">
        {PRECIP_RAMP.map((c) => (
          <i key={c} style={{ background: c }} />
        ))}
      </span>
      <span className="ws4000-precip-end" aria-hidden="true">Heavy</span>
      <span className="ws4000-precip-nd" aria-hidden="true">
        <i style={{ background: INCOMPLETE_DATA_COLOR }} />
        = Incomplete Data
      </span>
    </div>
  );
}
