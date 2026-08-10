/**
 * The mnemonic, given something to look at.
 *
 * The three-bell TWC signature already played at startup, but against the
 * "Loading" scene — so on a cold start you heard the jingle over an empty
 * screen and then the app simply appeared. The real units led with the
 * network identity before dropping into Current Conditions, which is what
 * this restores.
 *
 * It is deliberately NOT a loading spinner. Data fetching is independent of
 * this and always has been: the scheduler prepares the first scene while the
 * mnemonic plays, so the splash costs nothing in time to first forecast. It
 * is there because the signature deserves a frame, not because anything is
 * being waited on.
 *
 * ACCESSIBILITY. `aria-hidden` throughout, and it takes no focus. A blind
 * user gains nothing from being told a logo is on screen, and the startup
 * announcement ("Accessible Weather Center is ready…") is already speaking
 * over the top of it through the live region. Announcing the splash as well
 * would just delay the part that carries information.
 */
import { useEffect, useState } from "react";

interface Props {
  /** True from audio unlock until the mnemonic finishes. */
  visible: boolean;
  /** Machine whose branding to show, so the splash matches the skin. */
  themeId: string;
}

export function StartupSplash({ visible, themeId }: Props) {
  // Keep the element mounted briefly after `visible` drops so the fade has
  // something to fade. Unmounting immediately would cut it dead.
  const [present, setPresent] = useState(visible);
  useEffect(() => {
    if (visible) { setPresent(true); return; }
    const t = setTimeout(() => setPresent(false), 700);
    return () => clearTimeout(t);
  }, [visible]);

  if (!present) return null;

  return (
    <div
      className="ws-startup-splash"
      data-visible={visible ? "true" : "false"}
      data-theme={themeId}
      aria-hidden="true"
    >
      <img
        className="ws-startup-splash-mark"
        src="/assets/shared/logos/twc/TWC_Logo.png"
        alt=""
        // A missing logo must not leave a broken-image icon sitting over the
        // first scene. The library is optional; the app runs without it.
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
      />
    </div>
  );
}
