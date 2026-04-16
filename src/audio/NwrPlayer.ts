import type { AudioMixer } from "./AudioMixer";

/**
 * NOAA Weather Radio live stream player.
 *
 * Streams the weatherUSA Icecast feed for a chosen NWR transmitter call sign
 * and routes the audio through a dedicated `radio` bus on the AudioMixer.
 * The radio bus is independent of music and voice — narration ducks music
 * but does NOT duck the radio stream, since NWR audio is real-time weather
 * information that should remain audible.
 *
 * Stream URL pattern: `https://radio.weatherusa.net/NWR/{CALLSIGN}.mp3`
 * Format: MP3 32 kbps mono, ~22050 Hz.
 *
 * Reconnection: on stream error/stall/end, reconnects with exponential
 * backoff (2s → 4s → 8s → 16s, capped at 30s). Each reconnect bumps a
 * generation counter so stale timers from prior call signs don't fire.
 * After MAX_RECONNECT_ATTEMPTS consecutive failures without any successful
 * playback, the player gives up and emits a "failed" status so the UI can
 * tell the user the station is unreachable. Switching call signs resets
 * the counter and starts fresh.
 *
 * EAS tones in the stream: NWR audio is public domain and the FCC permits
 * rebroadcast within 1 hour. EAS Attention Signals embedded in the stream
 * are passed through as-is — we are a pass-through, not an EAS originator.
 * See docs/legacy-eras.md for the full legal note.
 */

const STREAM_URL_BASE = "https://radio.weatherusa.net/NWR/";
const MAX_RECONNECT_ATTEMPTS = 5;
/** If the audio element hasn't fired `playing` within this window after
 *  attaching, treat it as a stall and trigger a reconnect. Guards against
 *  servers that accept the connection but never send data. */
const CONNECT_TIMEOUT_MS = 10000;

export type NwrStatus =
  | "idle"
  | "connecting"
  | "streaming"
  | "reconnecting"
  | "failed";

export interface NwrStatusInfo {
  callSign: string | null;
  attempt: number;
  /** Last error message, if any — present on "reconnecting" and "failed". */
  error?: string;
}

export class NwrPlayer {
  private mixer: AudioMixer;
  private element: HTMLAudioElement | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private callSign: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempt = 0;
  private generation = 0;
  private status: NwrStatus = "idle";
  private statusListeners = new Set<(status: NwrStatus, info: NwrStatusInfo) => void>();
  private lastError: string | undefined;

  constructor(mixer: AudioMixer) {
    this.mixer = mixer;
  }

  /** Begin streaming the given NWR transmitter. Idempotent: if already
   *  connected to the same call sign, this is a no-op. Switching call
   *  signs disconnects the old stream first and resets the failure counter. */
  connect(callSign: string): void {
    const cs = callSign.toUpperCase().trim();
    if (!cs) return;
    if (this.callSign === cs && this.element) return;

    this.disconnect();
    this.callSign = cs;
    this.generation++;
    this.reconnectAttempt = 0;
    this.lastError = undefined;
    this.setStatus("connecting");
    this.attachStream(this.generation);
  }

  /** Stop streaming and release the audio element. */
  disconnect(): void {
    this.generation++;
    this.callSign = null;
    this.reconnectAttempt = 0;
    this.lastError = undefined;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    this.teardownStream();
    this.setStatus("idle");
  }

  isConnected(): boolean {
    return this.element != null && !this.element.paused;
  }

  getCallSign(): string | null {
    return this.callSign;
  }

  getStatus(): NwrStatus {
    return this.status;
  }

  /** Subscribe to status changes. The listener fires immediately with the
   *  current status, then on every change. Returns an unsubscribe function. */
  subscribeStatus(fn: (status: NwrStatus, info: NwrStatusInfo) => void): () => void {
    this.statusListeners.add(fn);
    fn(this.status, this.statusInfo());
    return () => this.statusListeners.delete(fn);
  }

  private statusInfo(): NwrStatusInfo {
    return {
      callSign: this.callSign,
      attempt: this.reconnectAttempt,
      error: this.lastError
    };
  }

  private setStatus(status: NwrStatus): void {
    if (this.status === status) return;
    this.status = status;
    const info = this.statusInfo();
    for (const fn of this.statusListeners) fn(status, info);
  }

  private attachStream(gen: number): void {
    if (gen !== this.generation) return;
    if (!this.callSign) return;

    const ctx = this.mixer.context();
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audio.preload = "auto";
    audio.src = `${STREAM_URL_BASE}${encodeURIComponent(this.callSign)}.mp3`;

    // Wire into the radio bus. MediaElementAudioSourceNode is permanently
    // bound to its element — we can't reuse it across reconnects, so we
    // build a fresh one every time.
    const source = ctx.createMediaElementSource(audio);
    source.connect(this.mixer.radioBus());

    audio.onerror = () => {
      const mediaError = audio.error;
      this.lastError = mediaError ? `media error code ${mediaError.code}` : "media error";
      this.scheduleReconnect(gen);
    };
    audio.onstalled = () => {
      this.lastError = "stream stalled";
      this.scheduleReconnect(gen);
    };
    audio.onended = () => {
      this.lastError = "stream ended";
      this.scheduleReconnect(gen);
    };
    audio.onplaying = () => {
      if (gen !== this.generation) return;
      if (this.connectTimer) {
        clearTimeout(this.connectTimer);
        this.connectTimer = null;
      }
      // Successful playback resets the failure counter so brief later
      // hiccups don't immediately exhaust the retry budget.
      this.reconnectAttempt = 0;
      this.lastError = undefined;
      this.setStatus("streaming");
    };

    this.element = audio;
    this.source = source;

    // Hard deadline: if we don't start receiving audio within this window,
    // treat it as a stall. Some servers accept the TCP connection but never
    // send any data, which neither `error` nor `stalled` reliably fires for.
    this.connectTimer = setTimeout(() => {
      if (gen !== this.generation) return;
      if (this.status === "streaming") return;
      this.lastError = "stream silent after connect timeout";
      this.scheduleReconnect(gen);
    }, CONNECT_TIMEOUT_MS);

    void audio.play().catch((err) => {
      // Autoplay denied (rare in Electron). Reconnect attempts will retry
      // on the next user gesture via the same handler chain.
      this.lastError = err instanceof Error ? err.message : "play() rejected";
      this.scheduleReconnect(gen);
    });
  }

  private teardownStream(): void {
    if (this.connectTimer) {
      clearTimeout(this.connectTimer);
      this.connectTimer = null;
    }
    if (this.element) {
      try {
        this.element.pause();
        this.element.removeAttribute("src");
        this.element.load();
      } catch {
        // ignore
      }
      this.element.onerror = null;
      this.element.onstalled = null;
      this.element.onended = null;
      this.element.onplaying = null;
      this.element = null;
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        // ignore
      }
      this.source = null;
    }
  }

  private scheduleReconnect(gen: number): void {
    if (gen !== this.generation) return;
    if (!this.callSign) return;
    if (this.reconnectTimer) return;

    this.reconnectAttempt++;

    // Give up after too many consecutive failures. The user gets told via
    // the "failed" status; they can pick another station or disable NWR.
    if (this.reconnectAttempt > MAX_RECONNECT_ATTEMPTS) {
      this.teardownStream();
      this.setStatus("failed");
      return;
    }

    const delayMs = Math.min(2000 * Math.pow(2, this.reconnectAttempt - 1), 30000);

    this.teardownStream();
    this.setStatus("reconnecting");
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.attachStream(gen);
    }, delayMs);
  }
}
