import { useEffect, useRef, useState } from "react";
import { ModalDialog } from "./ModalDialog";
import { resolveZipToPlace } from "../../core/places/zipLookup";
import type { Place } from "../../core/types";
import type { AnnouncementQueue } from "../../a11y/AnnouncementQueue";

interface Props {
  open: boolean;
  announcer: AnnouncementQueue;
  /** Called with the resolved place once the user commits a ZIP. The caller
   *  persists it (PlacesStore.completeFirstRun) and starts the app. */
  onComplete: (place: Place) => void;
}

/**
 * First-run location setup.
 *
 * Shown once, on a fresh install (or a browser profile that has never used
 * the app), before the scene cycle starts. Until the user picks a home
 * location there is nothing meaningful to forecast, so this dialog is
 * deliberately NOT dismissable — Escape and backdrop clicks re-state the
 * requirement instead of closing. That is the difference between this and
 * every other modal in the app.
 *
 * Blind-first details:
 *   - The prompt is announced through the assertive channel on open, so the
 *     user hears what is being asked without hunting for it.
 *   - ModalDialog moves focus to the ZIP field (first focusable child) and
 *     marks the rest of the app inert.
 *   - Success and failure both announce, and the failure text also lands in
 *     a role="alert" region inside the dialog for sighted users.
 *   - The resolved city/state is spoken back on success, so a mistyped ZIP
 *     that still resolves is caught by ear.
 */
export function FirstRunSetup({ open, announcer, onComplete }: Props) {
  const [zip, setZip] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const announcedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      announcedRef.current = false;
      return;
    }
    if (announcedRef.current) return;
    announcedRef.current = true;
    void announcer.announce(
      "Welcome to Accessible Weather Center. Before we start, enter your five digit ZIP code " +
        "to set your home location, then press Enter. You can change it later by pressing M for favorites.",
      "assertive"
    );
  }, [open, announcer]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const trimmed = zip.trim();
    if (trimmed.length !== 5) {
      setError("Enter all five digits of your ZIP code.");
      void announcer.announce("Enter all five digits of your ZIP code.", "assertive");
      return;
    }
    setBusy(true);
    setError(null);
    void announcer.announce(`Looking up ZIP ${trimmed}.`, "polite");
    try {
      const place = await resolveZipToPlace(trimmed);
      void announcer.announce(
        `Home set to ${place.name}, ${place.state}. Loading your forecast.`,
        "assertive"
      );
      onComplete(place);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Lookup failed.";
      setError(`${msg} Try another ZIP code.`);
      void announcer.announce(`${msg} Try another ZIP code.`, "assertive");
      setBusy(false);
    }
  };

  /** Escape / backdrop: restate the requirement rather than closing. There
   *  is no usable app state behind this dialog on a fresh install. */
  const refuseClose = () => {
    void announcer.announce(
      "A home location is required. Enter your five digit ZIP code to continue.",
      "assertive"
    );
  };

  return (
    <ModalDialog open={open} onClose={refuseClose} labelledBy="awc-firstrun-heading" minWidth={520}>
      <h2 id="awc-firstrun-heading" style={{ marginTop: 0 }}>
        Welcome to Accessible Weather Center
      </h2>
      <p style={{ color: "var(--ws-text-dim)" }}>
        Enter your US ZIP code to set your home location. Everything the app reports —
        conditions, forecasts, radar, and alerts — is based on this location. You can change
        it at any time by pressing <kbd>M</kbd> for favorites.
      </p>
      <form onSubmit={submit} style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16 }}>
        <label htmlFor="awc-firstrun-zip">ZIP code:</label>
        <input
          id="awc-firstrun-zip"
          type="text"
          inputMode="numeric"
          autoComplete="postal-code"
          pattern="\d{5}"
          maxLength={5}
          value={zip}
          disabled={busy}
          onChange={(e) => {
            setZip(e.target.value.replace(/\D/g, "").slice(0, 5));
            if (error) setError(null);
          }}
          placeholder="12345"
          aria-describedby="awc-firstrun-help"
          style={{
            padding: "8px 12px",
            width: 120,
            fontSize: "1.1rem",
            background: "var(--ws-bg-mid)",
            color: "var(--ws-text)",
            border: "1px solid var(--ws-accent)"
          }}
        />
        <button type="submit" disabled={busy || zip.length !== 5} style={{ padding: "8px 16px" }}>
          {busy ? "Looking up…" : "Continue"}
        </button>
      </form>
      <span id="awc-firstrun-help" className="sr-only">
        Enter a five digit United States ZIP code and press Enter to set your home location.
      </span>
      {error ? (
        <p role="alert" style={{ color: "var(--ws-alert, #ff6b6b)", marginBottom: 0 }}>
          {error}
        </p>
      ) : null}
    </ModalDialog>
  );
}
