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
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.linearRampToValueAtTime(this.duckLevel, this.ctx.currentTime + 0.15);
    }
  }

  unduck(): void {
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.linearRampToValueAtTime(this.musicLevel, this.ctx.currentTime + 0.2);
    }
  }

  setMusicLevel(v: number): void {
    this.musicLevel = clamp01(v);
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.linearRampToValueAtTime(this.musicLevel, this.ctx.currentTime + 0.1);
    }
  }

  setRadioLevel(v: number): void {
    this.radioLevel = clamp01(v);
    if (this.radioGain && this.ctx) {
      this.radioGain.gain.linearRampToValueAtTime(this.radioLevel, this.ctx.currentTime + 0.1);
    }
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
