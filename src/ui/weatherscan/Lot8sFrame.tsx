import { useEffect, useState, type ReactNode } from "react";

/**
 * The IntelliStar 2 LOT8s windowed frame.
 *
 * "LOT8s" is Local on the 8s — the segment, not a codename. From 2013 the
 * product no longer filled the screen: it played inside a window floating on
 * a blurred, darkened crop of the background, with a bar above carrying the
 * TWC logo, the LOT8s wordmark, the location and the clock, and the Lower
 * Display Line along the bottom.
 *
 * `docs/reference-capture-plan.md` records this as blocked — "we cannot build
 * the frame without it", meaning a full-frame still, and "the frame shell art
 * does not exist in the repo". Both are true and neither turned out to
 * matter, because TWC's own render scripts ship the geometry. The window is
 * not traced off a screenshot; it is transcribed from
 * `products/pm/Local/incl/_LOT8Setup.rs` in `twc_domestic_dynamic-2.10`.
 *
 * THE COORDINATE SYSTEM IS BOTTOM-UP, which is the thing to get right before
 * anything else. Every y below counts up from the bottom of a 720x480 raster.
 * The proof is in the intro animation:
 *
 *     blur_bg.setPosition(blur_bg.position()[0], blur_bg.position()[1] - blur_bg.size()[1])
 *     es_blur.addEffect(Slider(None, 0, blur_bg.size()[1] / 5.0), 5)
 *     es_blur.addEffect(SetPosition(None, blur_bg.position()[0], 117), 1)
 *
 * It starts at 117-263 = -146, slides by a positive dy for five frames, and
 * lands at 117 — and the comment above it reads "slide blurs up". A positive
 * dy moving something up means y grows upward. Read top-down instead and the
 * window lands off the bottom of the screen and the "top bar" at y=401 sits
 * near the floor. This is the same class of mistake as reading a Weatherscan
 * product coordinate as global when it was local to a scaled layer.
 *
 * MEASURED, all from _LOT8Setup.rs unless noted:
 *
 *     raster            720 x 480   (BlendImageFilter w=720 h=480, and the
 *                                    outro loop `while xSize < 720 or ySize < 480`)
 *     content window    pos(50, 117) size(620, 263)
 *     window dark wash  rgba(20, 20, 20, 0.10)   darkLayer2
 *     window blur       GaussianBlurImageFilter(50, 117, 620, 263)
 *     bar origin        (50, 401)                topBarPos
 *     bar backing       rgba(20, 20, 20, 0.40)   darkLayer
 *     location chip     rgba(20, 20, 20, 0.50), text padded 15px each side
 *     clock chip        100 wide, rgba(20, 20, 20, 0.30)
 *     headline          pos(60, 356), AkkoPro-Light 25pt, rgb(235, 235, 235)
 *     next headline     32 below the current one, the pair scroll — the rundown
 *     location text     AkkoPro-Light 32pt, uppercase, rgb(235, 235, 235)
 *     LDL band          pos(0, 22) size(720, 16), rgb(25, 68, 113),
 *                       HelveticaNeueLTStd-BdCn 16pt   [LdlMenu/Default.prod]
 *
 * INFERRED — exactly one number. The bar's height is `logo.size()[1]`, read
 * from a TIFF that ships on the machine rather than in the package, so it is
 * not knowable from here. It is bounded: the bar sits at y=401 on a 480-tall
 * raster, so it cannot exceed 79px. 44 is used below, which fits the 32pt
 * location text the script vertically centres inside it. If the art ever
 * turns up, this is the one constant to correct.
 */

/* Raster the coordinates were written against. */
const RASTER_W = 720;
const RASTER_H = 480;

/** Bottom-up render coordinates, exactly as the script states them. */
export const LOT8S = {
  window: { x: 50, y: 117, w: 620, h: 263 },
  barOrigin: { x: 50, y: 401 },
  /** The one inferred value. Bounded by 480-401=79. */
  barHeight: 44,
  clockChipW: 100,
  ldl: { x: 0, y: 22, w: 720, h: 16 },
  headline: { x: 60, y: 356 },
} as const;

/** Convert a bottom-up rect to the CSS percentages the stylesheet wants. */
export function toCssRect(r: { x: number; y: number; w: number; h: number }) {
  return {
    leftPct: (r.x / RASTER_W) * 100,
    topPct: ((RASTER_H - r.y - r.h) / RASTER_H) * 100,
    widthPct: (r.w / RASTER_W) * 100,
    heightPct: (r.h / RASTER_H) * 100,
  };
}

interface Props {
  /** The scene, rendered inside the window. */
  children: ReactNode;
  placeName: string | null;
  /** Current and upcoming product names — the scrolling rundown. */
  rundown?: readonly string[];
}

export function Lot8sFrame({ children, placeName, rundown = [] }: Props) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  // "%l:%M" in the script — 12-hour, space-padded, no seconds. The clock in
  // the bar is decoration; the header clock is the one that ticks.
  const clock = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="lot8s">
      {/* Bar. Decorative throughout: the location is in the scene's own
          heading and the time is in the frame header, so announcing either
          here would be the third time a screen reader hears it. */}
      <div className="lot8s-bar" aria-hidden="true">
        <span className="lot8s-bar-logo">TWC</span>
        <span className="lot8s-bar-lot8">LOCAL ON THE 8s</span>
        {placeName && <span className="lot8s-bar-loc">{placeName.toUpperCase()}</span>}
        <span className="lot8s-bar-clock">{clock}</span>
      </div>

      <div className="lot8s-window">
        {/* The rundown strip the script builds from headlineList: the current
            product and the next one, 32px apart, scrolling. Rendered as a
            list so browse mode can read what is coming up, which is the one
            thing the strip tells you that the scene itself does not. */}
        {rundown.length > 0 && (
          <div className="lot8s-rundown" aria-label="Coming up">
            {rundown.slice(0, 2).map((name, i) => (
              <span key={name} className="lot8s-rundown-item" data-current={i === 0}>
                {name}
              </span>
            ))}
          </div>
        )}
        <div className="lot8s-window-content">{children}</div>
      </div>
    </div>
  );
}
