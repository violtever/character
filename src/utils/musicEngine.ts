import { MUSIC_TRACKS } from '../config/mediaConfig';
import type { MusicTrack } from '../types/archive';

export interface MusicSnapshot {
  trackIndex: number;
  track: MusicTrack;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  usingCustomFile: boolean;
}

type Listener = (snapshot: MusicSnapshot) => void;

const AMBIENT_SCALES: Record<MusicTrack['ambientPreset'], number[]> = {
  // Warm ocean-porcelain major 9th pentatonic
  porcelain: [261.63, 293.66, 329.63, 392.0, 440.0, 493.88, 523.25, 587.33, 659.25],
  // Cinematic wine-burgundy minor 9th waltz
  burgundy: [220.0, 246.94, 261.63, 329.63, 392.0, 440.0, 493.88, 523.25, 659.25],
  // Soft contemplative Dorian library motif
  library: [293.66, 329.63, 349.23, 440.0, 493.88, 523.25, 587.33, 659.25, 698.46],
};

class BackgroundMusicEngine {
  private listeners = new Set<Listener>();
  private trackIndex = 0;
  private isPlaying = false;
  private isMuted = false;
  private volume = 0.36; // Comfortable moderate default volume
  private currentTime = 0;
  private duration = MUSIC_TRACKS[0]?.duration ?? 210;

  private htmlAudio: HTMLAudioElement | null = null;
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private synthTimer: number | null = null;
  private clockTimer: number | null = null;
  private noteStep = 0;

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getTrack(): MusicTrack {
    return MUSIC_TRACKS[this.trackIndex] ?? MUSIC_TRACKS[0];
  }

  public getSnapshot(): MusicSnapshot {
    const track = this.getTrack();
    return {
      trackIndex: this.trackIndex,
      track,
      isPlaying: this.isPlaying,
      isMuted: this.isMuted,
      volume: this.volume,
      currentTime: this.currentTime,
      duration: this.duration,
      usingCustomFile: Boolean(track.src && track.src.trim().length > 0),
    };
  }

  private emit(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  private ensureSynthContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.audioCtx = new AudioCtx();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = this.isMuted ? 0 : this.volume * 0.45;
      this.masterGain.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      void this.audioCtx.resume().catch(() => undefined);
    }
    return this.audioCtx;
  }

  private stopAllPlaybackInternals(): void {
    if (this.htmlAudio) {
      this.htmlAudio.pause();
    }
    if (this.synthTimer !== null) {
      window.clearInterval(this.synthTimer);
      this.synthTimer = null;
    }
    if (this.clockTimer !== null) {
      window.clearInterval(this.clockTimer);
      this.clockTimer = null;
    }
  }

  public async play(): Promise<void> {
    if (this.isPlaying) return;
    const track = this.getTrack();
    const hasCustomSrc = Boolean(track.src && track.src.trim().length > 0);

    if (hasCustomSrc) {
      try {
        if (!this.htmlAudio || this.htmlAudio.dataset.trackId !== track.id) {
          this.htmlAudio?.pause();
          const audio = new Audio(track.src);
          audio.dataset.trackId = track.id;
          audio.loop = false;
          audio.volume = this.isMuted ? 0 : this.volume;
          audio.addEventListener('loadedmetadata', () => {
            if (Number.isFinite(audio.duration) && audio.duration > 0) {
              this.duration = audio.duration;
              this.emit();
            }
          });
          audio.addEventListener('timeupdate', () => {
            this.currentTime = audio.currentTime;
            this.emit();
          });
          audio.addEventListener('ended', () => {
            this.nextTrack(true);
          });
          this.htmlAudio = audio;
        }
        this.htmlAudio.volume = this.isMuted ? 0 : this.volume;
        await this.htmlAudio.play();
        this.isPlaying = true;
        this.emit();
        return;
      } catch {
        // If custom file cannot be played or is missing, gracefully fall back to ambient synth
      }
    }

    const ctx = this.ensureSynthContext();
    if (!ctx || !this.masterGain) return;

    this.duration = track.duration;
    this.isPlaying = true;
    this.updateGain();
    this.triggerAmbientPhrase(ctx, track.ambientPreset);

    this.synthTimer = window.setInterval(() => {
      if (!this.isPlaying || !this.audioCtx) return;
      this.triggerAmbientPhrase(this.audioCtx, this.getTrack().ambientPreset);
    }, 2600);

    this.clockTimer = window.setInterval(() => {
      if (!this.isPlaying) return;
      this.currentTime += 0.5;
      if (this.currentTime >= this.duration) {
        this.nextTrack(true);
        return;
      }
      this.emit();
    }, 500);

    this.emit();
  }

  public pause(): void {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.stopAllPlaybackInternals();
    this.emit();
  }

  public togglePlay(): void {
    if (this.isPlaying) {
      this.pause();
    } else {
      void this.play();
    }
  }

  public setVolume(nextVol: number): void {
    this.volume = Math.max(0, Math.min(1, nextVol));
    if (this.volume > 0 && this.isMuted) {
      this.isMuted = false;
    }
    this.updateGain();
    this.emit();
  }

  public toggleMute(): void {
    this.isMuted = !this.isMuted;
    this.updateGain();
    this.emit();
  }

  public seek(targetSeconds: number): void {
    const clamped = Math.max(0, Math.min(this.duration, targetSeconds));
    this.currentTime = clamped;
    if (this.htmlAudio && this.getSnapshot().usingCustomFile) {
      try {
        this.htmlAudio.currentTime = clamped;
      } catch {
        // Ignore seek before metadata loaded
      }
    }
    this.emit();
  }

  public setCustomTrack(title: string, artist: string, src: string): void {
    const customTrack: MusicTrack = {
      id: `drive-${Date.now()}`,
      title,
      artist,
      src,
      cover: MUSIC_TRACKS[0]?.cover ?? '',
      duration: 240,
      ambientPreset: 'porcelain',
    };
    MUSIC_TRACKS.unshift(customTrack);
    this.selectTrack(0, true);
  }

  public selectTrack(index: number, autoplay?: boolean): void {
    const safeIdx = ((index % MUSIC_TRACKS.length) + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
    const wasPlaying = autoplay ?? this.isPlaying;
    this.stopAllPlaybackInternals();
    this.isPlaying = false;
    this.trackIndex = safeIdx;
    this.currentTime = 0;
    this.noteStep = 0;
    this.duration = MUSIC_TRACKS[safeIdx].duration;
    this.emit();

    if (wasPlaying) {
      void this.play();
    }
  }

  public nextTrack(autoplay?: boolean): void {
    this.selectTrack(this.trackIndex + 1, autoplay);
  }

  public prevTrack(autoplay?: boolean): void {
    this.selectTrack(this.trackIndex - 1, autoplay);
  }

  private updateGain(): void {
    if (this.htmlAudio) {
      this.htmlAudio.volume = this.isMuted ? 0 : this.volume;
    }
    if (this.masterGain && this.audioCtx) {
      const target = this.isMuted ? 0.0001 : this.volume * 0.45;
      this.masterGain.gain.setTargetAtTime(target, this.audioCtx.currentTime, 0.08);
    }
  }

  private triggerAmbientPhrase(
    ctx: AudioContext,
    preset: MusicTrack['ambientPreset']
  ): void {
    if (!this.masterGain) return;
    const scale = AMBIENT_SCALES[preset];
    const now = ctx.currentTime;

    // Warm low-passed pad note on every other step
    if (this.noteStep % 2 === 0) {
      const rootFreq = scale[(this.noteStep / 2) % 4] * 0.5;
      const padOsc = ctx.createOscillator();
      const padGain = ctx.createGain();
      const padFilter = ctx.createBiquadFilter();

      padOsc.type = 'sine';
      padOsc.frequency.setValueAtTime(rootFreq, now);

      padFilter.type = 'lowpass';
      padFilter.frequency.setValueAtTime(420, now);

      padGain.gain.setValueAtTime(0.0001, now);
      padGain.gain.linearRampToValueAtTime(0.14, now + 1.1);
      padGain.gain.exponentialRampToValueAtTime(0.0001, now + 5.0);

      padOsc.connect(padFilter);
      padFilter.connect(padGain);
      padGain.connect(this.masterGain);

      padOsc.start(now);
      padOsc.stop(now + 5.1);
    }

    // Delicate celesta/felt-piano two-note arpeggio
    const patternA = [0, 2, 4, 6, 5, 3, 7, 4];
    const patternB = [4, 6, 8, 5, 7, 2, 6, 3];
    const f1 = scale[patternA[this.noteStep % patternA.length]];
    const f2 = scale[patternB[this.noteStep % patternB.length]];

    [
      { freq: f1, offset: 0.05, amp: 0.085, dur: 2.2 },
      { freq: f2, offset: 0.95, amp: 0.065, dur: 2.4 },
    ].forEach(({ freq, offset, amp, dur }) => {
      if (!this.masterGain) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + offset);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1150, now + offset);

      gain.gain.setValueAtTime(0.0001, now + offset);
      gain.gain.linearRampToValueAtTime(amp, now + offset + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now + offset);
      osc.stop(now + offset + dur + 0.05);
    });

    this.noteStep += 1;
  }
}

export const musicPlayer = new BackgroundMusicEngine();
