/**
 * Web Audio mixer with two buses: music and voice. When voice plays, music
 * ducks to a low gain so the user can always hear narration. The mixer
 * doesn't *play* anything itself — MusicPlayer and ClipLibrary do — it just
 * owns the routing graph and the duck state.
 */
export class AudioMixer {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private voiceGain: GainNode | null = null;
  private duckLevel = 0.15;
  private musicLevel = 0.6;

  ensureStarted(): AudioContext {
    if (!this.ctx) {
      const Ctor: typeof AudioContext = (window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
      this.ctx = new Ctor();
      this.musicGain = this.ctx.createGain();
      this.voiceGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicLevel;
      this.voiceGain.gain.value = 1.0;
      this.musicGain.connect(this.ctx.destination);
      this.voiceGain.connect(this.ctx.destination);
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
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
