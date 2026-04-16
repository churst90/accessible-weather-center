import type { AudioMixer } from "./AudioMixer";

/**
 * Synthesizes alert chimes through the mixer's voice bus. We do NOT bundle
 * or play the real EAS Attention Signal (47 CFR §11.45) — instead we
 * generate the public-domain NOAA Weather Radio 1050 Hz tone, plus a few
 * custom chimes for less-severe alerts.
 *
 * The user does have a "Severe Weather Alert tone.mp3" file in their clip
 * library; if they prefer to use that we can plumb it in via the file-based
 * path, but synthesis is the default because it's both safer and more
 * configurable (you can adjust duration without re-rendering audio).
 */
export class AlertTones {
  constructor(private readonly mixer: AudioMixer) {}

  /** NOAA Weather Radio 1050 Hz tone, default 8 seconds with envelope. */
  async playNwr1050(durationSec = 8): Promise<void> {
    const ctx = this.mixer.context();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1050;
    osc.type = "sine";
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.6, now + 0.2);
    gain.gain.setValueAtTime(0.6, now + durationSec - 0.2);
    gain.gain.linearRampToValueAtTime(0, now + durationSec);
    osc.connect(gain).connect(this.mixer.voiceBus());
    osc.start(now);
    osc.stop(now + durationSec);
    await wait(durationSec * 1000);
  }

  /** Three-note advisory chime — gentle, attention-grabbing without urgency. */
  async playAdvisory(): Promise<void> {
    const ctx = this.mixer.context();
    const notes = [659.25, 783.99, 880.0]; // E5, G5, A5
    const noteDur = 0.25;
    const start = ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.type = "sine";
      const t = start + i * noteDur;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.5, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + noteDur);
      osc.connect(gain).connect(this.mixer.voiceBus());
      osc.start(t);
      osc.stop(t + noteDur);
    });
    await wait(notes.length * noteDur * 1000);
  }

  /** Four-note warning chime — urgent. Used before severe-weather narration. */
  async playWarning(): Promise<void> {
    const ctx = this.mixer.context();
    const pattern = [
      { freq: 880, dur: 0.18 },
      { freq: 659, dur: 0.18 },
      { freq: 880, dur: 0.18 },
      { freq: 1175, dur: 0.36 }
    ];
    const start = ctx.currentTime;
    let cursor = start;
    for (const p of pattern) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = p.freq;
      osc.type = "triangle";
      gain.gain.setValueAtTime(0, cursor);
      gain.gain.linearRampToValueAtTime(0.55, cursor + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, cursor + p.dur);
      osc.connect(gain).connect(this.mixer.voiceBus());
      osc.start(cursor);
      osc.stop(cursor + p.dur);
      cursor += p.dur;
    }
    await wait((cursor - start) * 1000);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
