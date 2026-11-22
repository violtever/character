import { MUSIC_TRACKS } from '../config/mediaConfig';
import {
  loadTrackAudioBlobUrl,
  revokeCachedTrackAudio,
} from '../services/musicService';
import type { MusicTrack, RepeatMode } from '../types/archive';

export interface MusicSnapshot {
  playlist: MusicTrack[];
  trackIndex: number;
  track: MusicTrack;
  isPlaying: boolean;
  isLoadingTrack: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  repeatMode: RepeatMode;
  usingCustomFile: boolean;
  playbackNotice: string | null;
}

type Listener = (snapshot: MusicSnapshot) => void;

const AMBIENT_SCALES: Record<'porcelain' | 'burgundy' | 'library', number[]> = {
  // Warm ocean-porcelain major 9th pentatonic
  porcelain: [261.63, 293.66, 329.63, 392.0, 440.0, 493.88, 523.25, 587.33, 659.25],
  // Cinematic wine-burgundy minor 9th waltz
  burgundy: [220.0, 246.94, 261.63, 329.63, 392.0, 440.0, 493.88, 523.25, 659.25],
  // Soft contemplative Dorian library motif
  library: [293.66, 329.63, 349.23, 440.0, 493.88, 523.25, 587.33, 659.25, 698.46],
};

function cloneBuiltInTracks(): MusicTrack[] {
  return MUSIC_TRACKS.map((t) => ({
    ...t,
    audioType: t.src && t.src.trim().length > 0 ? 'url' : 'ambient',
    isBuiltIn: true,
  }));
}

class BackgroundMusicEngine {
  private listeners = new Set<Listener>();
  private playlist: MusicTrack[] = cloneBuiltInTracks();
  private transientDriveTrack: MusicTrack | null = null;
  private trackIndex = 0;
  private isPlaying = false;
  private isLoadingTrack = false;
  private isMuted = false;
  private volume = 0.36;
  private currentTime = 0;
  private duration = MUSIC_TRACKS[0]?.duration ?? 210;
  private repeatMode: RepeatMode = 'all';
  private playbackNotice: string | null = null;

  private htmlAudio: HTMLAudioElement | null = null;
  private loadedTrackKey: string | null = null;
  private playRequestSeq = 0;
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
    return (
      this.playlist[this.trackIndex] ??
      this.playlist[0] ??
      cloneBuiltInTracks()[0]
    );
  }

  public getSnapshot(): MusicSnapshot {
    const track = this.getTrack();
    const usingCustomFile =
      track.audioType === 'chunks' ||
      (track.audioType !== 'ambient' && Boolean(track.src && track.src.trim()));
    return {
      playlist: this.playlist,
      trackIndex: this.trackIndex,
      track,
      isPlaying: this.isPlaying,
      isLoadingTrack: this.isLoadingTrack,
      isMuted: this.isMuted,
      volume: this.volume,
      currentTime: this.currentTime,
      duration: this.duration,
      repeatMode: this.repeatMode,
      usingCustomFile,
      playbackNotice: this.playbackNotice,
    };
  }

  private emit(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  private trackSourceKey(track: MusicTrack): string {
    return `${track.id}:${track.audioType ?? 'ambient'}:${track.audioVersion ?? 1}:${track.src}`;
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

  private disposeHtmlAudio(): void {
    if (this.htmlAudio) {
      try {
        this.htmlAudio.pause();
        this.htmlAudio.removeAttribute('src');
        this.htmlAudio.load();
      } catch {
        // Ignore media element cleanup errors
      }
      this.htmlAudio = null;
      this.loadedTrackKey = null;
    }
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

  /**
   * Live-syncs Admin-managed tracks from Firestore into the active playlist.
   * Handles track edits, audio replacements, and safe removal of the currently
   * playing track without crashing or freezing the UI.
   */
  public setPlaylist(dbTracks: MusicTrack[]): void {
    const prevTrack = this.getTrack();
    const prevKey = prevTrack ? this.trackSourceKey(prevTrack) : null;
    const wasPlaying = this.isPlaying;

    const baseList = dbTracks.length > 0 ? [...dbTracks] : cloneBuiltInTracks();
    const nextPlaylist = this.transientDriveTrack
      ? [this.transientDriveTrack, ...baseList]
      : baseList;

    this.playlist = nextPlaylist;

    if (!prevTrack) {
      this.trackIndex = 0;
      this.currentTime = 0;
      this.duration = nextPlaylist[0]?.duration || 0;
      this.emit();
      return;
    }

    const nextIdx = nextPlaylist.findIndex((t) => t.id === prevTrack.id);

    if (nextIdx >= 0) {
      // Current track still exists: preserve position and check if audio source changed
      this.trackIndex = nextIdx;
      const updatedTrack = nextPlaylist[nextIdx];
      const nextKey = this.trackSourceKey(updatedTrack);

      if (prevKey !== nextKey) {
        // Admin replaced the audio file for the currently loaded track
        this.playRequestSeq += 1;
        this.stopAllPlaybackInternals();
        this.disposeHtmlAudio();
        this.isPlaying = false;
        this.isLoadingTrack = false;
        this.currentTime = 0;
        this.duration = updatedTrack.duration || 0;
        this.playbackNotice = null;
        this.emit();
        if (wasPlaying) {
          void this.play();
        }
        return;
      }

      if (updatedTrack.duration > 0 && this.duration === 0) {
        this.duration = updatedTrack.duration;
      }
      this.emit();
      return;
    }

    // Currently active track was deleted by Admin -> recover cleanly without error
    revokeCachedTrackAudio(prevTrack.id);
    this.playRequestSeq += 1;
    this.stopAllPlaybackInternals();
    this.disposeHtmlAudio();
    this.isPlaying = false;
    this.isLoadingTrack = false;
    this.currentTime = 0;
    this.noteStep = 0;
    this.trackIndex = Math.min(this.trackIndex, Math.max(0, nextPlaylist.length - 1));
    this.duration = nextPlaylist[this.trackIndex]?.duration || 0;
    this.playbackNotice = wasPlaying
      ? 'Bài hát đang phát vừa được gỡ khỏi danh sách.'
      : null;
    this.emit();
  }

  private handleTrackEnded(): void {
    if (this.repeatMode === 'one') {
      this.currentTime = 0;
      if (this.htmlAudio) {
        this.htmlAudio.currentTime = 0;
        void this.htmlAudio.play().catch(() => {
          this.isPlaying = false;
          this.emit();
        });
      } else {
        this.noteStep = 0;
      }
      this.emit();
      return;
    }

    if (this.repeatMode === 'off') {
      if (this.trackIndex < this.playlist.length - 1) {
        this.selectTrack(this.trackIndex + 1, true);
      } else {
        this.stopAllPlaybackInternals();
        this.isPlaying = false;
        this.currentTime = 0;
        if (this.htmlAudio) {
          try {
            this.htmlAudio.currentTime = 0;
          } catch {
            // Ignore reset error
          }
        }
        this.emit();
      }
      return;
    }

    // repeatMode === 'all'
    if (this.playlist.length <= 1) {
      this.currentTime = 0;
      if (this.htmlAudio) {
        this.htmlAudio.currentTime = 0;
        void this.htmlAudio.play().catch(() => {
          this.isPlaying = false;
          this.emit();
        });
      }
      this.emit();
      return;
    }
    this.selectTrack(this.trackIndex + 1, true);
  }

  private async resolvePlayableUrl(track: MusicTrack): Promise<string | null> {
    if (track.audioType === 'chunks') {
      return loadTrackAudioBlobUrl(
        track.id,
        track.audioVersion ?? 1,
        track.audioMimeType || 'audio/mpeg'
      );
    }
    if (track.src && track.src.trim().length > 0) {
      return track.src.trim();
    }
    return null;
  }

  public async play(): Promise<void> {
    if (this.isPlaying) return;
    const track = this.getTrack();
    if (!track) return;

    const reqSeq = ++this.playRequestSeq;
    this.playbackNotice = null;

    const isFileBacked =
      track.audioType === 'chunks' ||
      (track.audioType !== 'ambient' && Boolean(track.src && track.src.trim()));

    if (isFileBacked) {
      const sourceKey = this.trackSourceKey(track);
      try {
        if (!this.htmlAudio || this.loadedTrackKey !== sourceKey) {
          this.isLoadingTrack = true;
          this.emit();

          const playableUrl = await this.resolvePlayableUrl(track);
          if (reqSeq !== this.playRequestSeq) return; // Superseded by another user action
          if (!playableUrl) {
            throw new Error('Không tìm thấy tệp âm thanh của bài hát.');
          }

          this.disposeHtmlAudio();
          const audio = new Audio(playableUrl);
          audio.preload = 'auto';
          audio.loop = false;
          audio.volume = this.isMuted ? 0 : this.volume;

          audio.addEventListener('loadedmetadata', () => {
            if (this.htmlAudio !== audio) return;
            if (Number.isFinite(audio.duration) && audio.duration > 0) {
              this.duration = audio.duration;
              this.emit();
            }
          });
          audio.addEventListener('timeupdate', () => {
            if (this.htmlAudio !== audio) return;
            this.currentTime = audio.currentTime;
            this.emit();
          });
          audio.addEventListener('ended', () => {
            if (this.htmlAudio !== audio) return;
            this.handleTrackEnded();
          });
          audio.addEventListener('error', () => {
            if (this.htmlAudio !== audio) return;
            this.isPlaying = false;
            this.isLoadingTrack = false;
            this.playbackNotice =
              'Không thể phát tệp âm thanh này trên trình duyệt hiện tại.';
            this.emit();
          });

          this.htmlAudio = audio;
          this.loadedTrackKey = sourceKey;
          this.isLoadingTrack = false;
        }

        if (reqSeq !== this.playRequestSeq || !this.htmlAudio) return;
        this.htmlAudio.volume = this.isMuted ? 0 : this.volume;
        await this.htmlAudio.play();

        if (reqSeq !== this.playRequestSeq) {
          this.htmlAudio.pause();
          return;
        }

        this.isPlaying = true;
        this.isLoadingTrack = false;
        this.playbackNotice = null;
        this.emit();
        return;
      } catch (err) {
        if (reqSeq !== this.playRequestSeq) return;
        this.isLoadingTrack = false;
        this.isPlaying = false;

        const isAutoplayBlocked =
          err instanceof DOMException && err.name === 'NotAllowedError';
        this.playbackNotice = isAutoplayBlocked
          ? 'Trình duyệt chưa cho phép tự phát nhạc. Nhấn nút Phát để nghe.'
          : err instanceof Error
            ? err.message
            : 'Không thể phát bài hát này.';
        this.emit();
        return;
      }
    }

    // Built-in ambient synth fallback for default archive tracks
    const ctx = this.ensureSynthContext();
    if (!ctx || !this.masterGain) return;
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {
        this.isPlaying = false;
        this.playbackNotice =
          'Trình duyệt chưa cho phép tự phát nhạc. Nhấn nút Phát để nghe.';
        this.emit();
        return;
      }
    }

    if (reqSeq !== this.playRequestSeq) return;
    this.duration = track.duration || 210;
    this.isPlaying = true;
    this.updateGain();
    this.triggerAmbientPhrase(ctx, track.ambientPreset ?? 'porcelain');

    this.synthTimer = window.setInterval(() => {
      if (!this.isPlaying || !this.audioCtx) return;
      this.triggerAmbientPhrase(
        this.audioCtx,
        this.getTrack().ambientPreset ?? 'porcelain'
      );
    }, 2600);

    this.clockTimer = window.setInterval(() => {
      if (!this.isPlaying) return;
      this.currentTime += 0.5;
      if (this.currentTime >= this.duration) {
        this.handleTrackEnded();
        return;
      }
      this.emit();
    }, 500);

    this.emit();
  }

  public pause(): void {
    this.playRequestSeq += 1;
    this.isLoadingTrack = false;
    if (!this.isPlaying) {
      this.emit();
      return;
    }
    this.isPlaying = false;
    this.stopAllPlaybackInternals();
    this.emit();
  }

  public togglePlay(): void {
    if (this.isPlaying || this.isLoadingTrack) {
      this.pause();
    } else {
      void this.play();
    }
  }

  public toggleRepeatMode(): void {
    const order: RepeatMode[] = ['all', 'one', 'off'];
    const idx = order.indexOf(this.repeatMode);
    this.repeatMode = order[(idx + 1) % order.length];
    this.emit();
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
    const clamped = Math.max(0, Math.min(this.duration || 0, targetSeconds));
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
      audioType: 'url',
      ambientPreset: 'porcelain',
      isBuiltIn: false,
    };
    this.transientDriveTrack = customTrack;
    const withoutOldDrive = this.playlist.filter(
      (t) => !t.id.startsWith('drive-')
    );
    this.playlist = [customTrack, ...withoutOldDrive];
    this.selectTrack(0, true);
  }

  public playTrackById(trackId: string): void {
    const idx = this.playlist.findIndex((t) => t.id === trackId);
    if (idx < 0) return;
    if (idx === this.trackIndex) {
      this.togglePlay();
      return;
    }
    this.selectTrack(idx, true);
  }

  public selectTrack(index: number, autoplay?: boolean): void {
    if (this.playlist.length === 0) return;
    const safeIdx =
      ((index % this.playlist.length) + this.playlist.length) %
      this.playlist.length;
    const wasPlaying = autoplay ?? this.isPlaying;
    this.playRequestSeq += 1;
    this.stopAllPlaybackInternals();
    this.disposeHtmlAudio();
    this.isPlaying = false;
    this.isLoadingTrack = false;
    this.trackIndex = safeIdx;
    this.currentTime = 0;
    this.noteStep = 0;
    this.playbackNotice = null;
    this.duration = this.playlist[safeIdx]?.duration ?? 0;
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
      this.masterGain.gain.setTargetAtTime(
        target,
        this.audioCtx.currentTime,
        0.08
      );
    }
  }

  private triggerAmbientPhrase(
    ctx: AudioContext,
    preset: 'porcelain' | 'burgundy' | 'library'
  ): void {
    if (!this.masterGain) return;
    const scale = AMBIENT_SCALES[preset];
    const now = ctx.currentTime;

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
