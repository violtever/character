import { SFX_FILE_PATHS } from '../config/mediaConfig';
import type { SfxName } from '../types/archive';

const SFX_STORAGE_KEY = 'character_archive_sfx_enabled';

class SfxEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private unlocked = false;
  private lastHoverAt = 0;
  private audioCache = new Map<string, HTMLAudioElement>();

  constructor() {
    if (typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(SFX_STORAGE_KEY);
        if (stored !== null) {
          this.enabled = stored === 'true';
        }
      } catch {
        // Ignore storage restrictions
      }
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(next: boolean): void {
    this.enabled = next;
    try {
      window.localStorage.setItem(SFX_STORAGE_KEY, String(next));
    } catch {
      // Ignore storage restrictions
    }
  }

  public unlock(): void {
    this.unlocked = true;
    this.ensureContext();
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  public play(name: SfxName): void {
    if (!this.enabled) return;

    // Hover sounds only play after user gesture unlock & are gently rate-limited
    if (name === 'hover') {
      if (!this.unlocked) return;
      const now = performance.now();
      if (now - this.lastHoverAt < 90) return;
      this.lastHoverAt = now;
    } else {
      this.unlocked = true;
    }

    const customSrc = SFX_FILE_PATHS[name];
    if (customSrc && customSrc.trim().length > 0) {
      this.playCustomAudio(customSrc, name === 'hover' ? 0.16 : 0.34);
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    this.synthesize(ctx, name);
  }

  private playCustomAudio(src: string, volume: number): void {
    try {
      let base = this.audioCache.get(src);
      if (!base) {
        base = new Audio(src);
        base.preload = 'auto';
        this.audioCache.set(src, base);
      }
      const instance = base.cloneNode(true) as HTMLAudioElement;
      instance.volume = volume;
      void instance.play().catch(() => undefined);
    } catch {
      // Ignore playback restriction errors
    }
  }

  private synthesize(ctx: AudioContext, name: SfxName): void {
    const now = ctx.currentTime;

    const playTone = (
      freqStart: number,
      freqEnd: number,
      duration: number,
      gainPeak: number,
      type: OscillatorType = 'sine',
      delay = 0
    ) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2400, now + delay);

      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, now + delay);
      if (freqEnd !== freqStart) {
        osc.frequency.exponentialRampToValueAtTime(freqEnd, now + delay + duration);
      }

      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.linearRampToValueAtTime(gainPeak, now + delay + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + duration + 0.02);
    };

    switch (name) {
      case 'hover':
        // Feather-light warm glass tap
        playTone(620, 690, 0.055, 0.018, 'sine');
        break;

      case 'filterSelect':
        // Soft tactile paper-click pop
        playTone(460, 580, 0.075, 0.038, 'triangle');
        break;

      case 'welcomeClick':
        // Airy two-note archival chime on entry
        playTone(392, 392, 0.34, 0.055, 'sine', 0);
        playTone(587.33, 587.33, 0.48, 0.048, 'triangle', 0.085);
        playTone(783.99, 783.99, 0.56, 0.032, 'sine', 0.16);
        break;

      case 'loadingComplete':
        // Luminous resolving triad
        playTone(523.25, 523.25, 0.45, 0.045, 'sine', 0);
        playTone(659.25, 659.25, 0.52, 0.04, 'sine', 0.09);
        playTone(783.99, 783.99, 0.72, 0.036, 'triangle', 0.18);
        break;

      case 'openCharacter':
        // Gentle rising folio turn
        playTone(370, 493.88, 0.18, 0.042, 'sine', 0);
        playTone(554.37, 554.37, 0.26, 0.03, 'triangle', 0.06);
        break;

      case 'close':
        // Soft descending settle
        playTone(440, 329.63, 0.14, 0.034, 'sine', 0);
        break;

      case 'themeSwitch':
        // Velvety harmonic shimmer
        playTone(415.3, 523.25, 0.22, 0.04, 'sine', 0);
        playTone(622.25, 622.25, 0.28, 0.025, 'sine', 0.05);
        break;

      case 'favorite':
        // Warm delicate sparkle interval
        playTone(587.33, 587.33, 0.16, 0.036, 'sine', 0);
        playTone(880, 880, 0.24, 0.028, 'sine', 0.07);
        break;

      case 'copy':
        // Crisp confirmation double-pip
        playTone(660, 660, 0.08, 0.03, 'sine', 0);
        playTone(880, 880, 0.12, 0.028, 'sine', 0.06);
        break;
    }
  }
}

export const sfx = new SfxEngine();
