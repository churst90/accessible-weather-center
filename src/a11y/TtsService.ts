/**
 * Pluggable TTS. Default implementation wraps the Web Speech API; the same
 * interface lets us swap in a native voice on mobile or a higher-quality
 * server-side voice later without touching callers.
 *
 * Single responsibility: turn strings into speech and let the caller cancel
 * or wait. Coordination with music/clip ducking lives in AudioMixer.
 */
export interface TtsService {
  speak(text: string, opts?: SpeakOptions): Promise<void>;
  cancel(): void;
  isSpeaking(): boolean;
  setRate(rate: number): void;
  setVoice(voiceName: string): void;
  listVoices(): string[];
}

export interface SpeakOptions {
  /** "polite" queues; "assertive" cancels current speech first. */
  priority?: "polite" | "assertive";
  rate?: number;
}

export class WebSpeechTts implements TtsService {
  private rate = 1.0;
  private voice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      const apply = () => {
        const voices = window.speechSynthesis.getVoices();
        const preferred = voices.find((v) => /en[-_]US/i.test(v.lang)) ?? voices[0];
        if (preferred) this.voice = preferred;
      };
      apply();
      window.speechSynthesis.onvoiceschanged = apply;
    }
  }

  speak(text: string, opts: SpeakOptions = {}): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        resolve();
        return;
      }
      if (opts.priority === "assertive") {
        window.speechSynthesis.cancel();
      }
      const utter = new SpeechSynthesisUtterance(text);
      utter.rate = opts.rate ?? this.rate;
      if (this.voice) utter.voice = this.voice;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      window.speechSynthesis.speak(utter);
    });
  }

  cancel(): void {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  }

  isSpeaking(): boolean {
    return typeof window !== "undefined" && !!window.speechSynthesis?.speaking;
  }

  setRate(rate: number): void {
    this.rate = Math.max(0.5, Math.min(2.0, rate));
  }

  setVoice(voiceName: string): void {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const v = window.speechSynthesis.getVoices().find((x) => x.name === voiceName);
    if (v) this.voice = v;
  }

  listVoices(): string[] {
    if (typeof window === "undefined" || !window.speechSynthesis) return [];
    return window.speechSynthesis.getVoices().map((v) => v.name);
  }
}
