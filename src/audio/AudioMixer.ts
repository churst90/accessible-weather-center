/**
 * Web Audio mixer with three buses: music, voice, and radio. When voice
 * plays, music ducks to a low gain so the user can always hear narration.
 * The radio bus (NWR Weather Radio stream) is independent — it does not
 * get ducked by voice, because NWR audio is real-time weather information
 * that should remain audible alongside narration. All three volumes are
 * user-adjustable via settings.
 */
export class AudioMixer {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private radioGain: GainNode | null = null;
  private duckLevel = 0.15;
  private musicLevel = 0.6;
  private radioLevel = 0.5;
  /** True while narration holds the music bus down. setMusicLevel() must
   *  respect this — it used to ramp straight back to full volume, so any
   *  settings change mid-narration (volume keys!) surged music over the
   *  voice clips. */
  private ducked = false;

  ensureStarted(): AudioContext {
    if (!this.ctx) {
      const Ctor: typeof AudioContext = (window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      this.ctx = new Ctor();
      this.musicGain = this.ctx.createGain();
      this.voiceGain = this.ctx.createGain();
      this.radioGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicLevel;
      this.voiceGain.gain.value = 1.0;
      this.radioGain.gain.value = this.radioLevel;
      this.musicGain.connect(this.ctx.destination);
      this.voiceGain.connect(this.ctx.destination);
      this.radioGain.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  context(): AudioContext {
    return this.ensureStarted();
  }

  musicBus(): GainNode {
    this.ensureStarted();
    return this.musicGain!;
  }

  voiceBus(): GainNode {
    this.ensureStarted();
    return this.voiceGain!;
  }

  radioBus(): GainNode {
    this.ensureStarted();
    return this.radioGain!;
  }

  duck(): void {
    this.ducked = true;
    this.rampMusicTo(this.duckTarget(), 0.15);
  }

  unduck(): void {
    this.ducked = false;
    this.rampMusicTo(this.musicLevel, 0.2);
  }

  setMusicLevel(v: number): void {
    this.musicLevel = clamp01(v);
    // While narration is ducking, the new user level takes effect only in
    // the duck target; the full level applies at the next unduck().
    this.rampMusicTo(this.ducked ? this.duckTarget() : this.musicLevel, 0.1);
  }

  setRadioLevel(v: number): void {
    this.radioLevel = clamp01(v);
    if (this.radioGain && this.ctx) {
      this.radioGain.gain.linearRampToValueAtTime(this.radioLevel, this.ctx.currentTime + 0.1);
    }
  }

  /** Never duck LOUDER than the user's chosen music level. */
  private duckTarget(): number {
    return Math.min(this.duckLevel, this.musicLevel);
  }

  private rampMusicTo(target: number, seconds: number): void {
    if (!this.musicGain || !this.ctx) return;
    const gain = this.musicGain.gain;
    // Anchor the ramp at the current value; without this, rapid
    // duck/unduck/setLevel sequences produce jumpy transitions because
    // linearRamp interpolates from the previous *scheduled* point.
    gain.cancelScheduledValues(this.ctx.currentTime);
    gain.setValueAtTime(gain.value, this.ctx.currentTime);
    gain.linearRampToValueAtTime(target, this.ctx.currentTime + seconds);
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
