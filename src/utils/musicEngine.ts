import {
  loadTrackAudioBlobUrl,
  revokeCachedTrackAudio,
} from '../services/musicService';
import type { MusicTrack, RepeatMode } from '../types/archive';

export interface MusicSnapshot {
  playlist: MusicTrack[];
  trackIndex: number;
  track: MusicTrack | null;
  isPlaying: boolean;
  isLoadingTrack: boolean;
  isMuted: boolean;
  volume: number;
  currentTime: number;
  duration: number;
  repeatMode: RepeatMode;
  playbackNotice: string | null;
  autoplayBlocked: boolean;
}

type Listener = (snapshot: MusicSnapshot) => void;

class BackgroundMusicEngine {
  private listeners = new Set<Listener>();
  private playlist: MusicTrack[] = [];
  private transientDriveTrack: MusicTrack | null = null;
  private trackIndex = 0;
  private isPlaying = false;
  private isLoadingTrack = false;
  private isMuted = false;
  private volume = 0.4;
  private currentTime = 0;
  private duration = 0;
  private repeatMode: RepeatMode = 'all';
  private playbackNotice: string | null = null;
  private autoplayBlocked = false;

  private htmlAudio: HTMLAudioElement | null = null;
  private loadedTrackKey: string | null = null;
  private playRequestSeq = 0;

  // Tracks whether loading-screen autoplay was requested before tracks arrived
  private pendingAutoplay = false;
  // Detacher for one-time gesture resume if browser blocks async autoplay
  private gestureResumeCleanup: (() => void) | null = null;

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getTrack(): MusicTrack | null {
    if (this.playlist.length === 0) return null;
    return this.playlist[this.trackIndex] ?? this.playlist[0] ?? null;
  }

  public getSnapshot(): MusicSnapshot {
    return {
      playlist: this.playlist,
      trackIndex: this.playlist.length > 0 ? this.trackIndex : -1,
      track: this.getTrack(),
      isPlaying: this.isPlaying,
      isLoadingTrack: this.isLoadingTrack,
      isMuted: this.isMuted,
      volume: this.volume,
      currentTime: this.currentTime,
      duration: this.duration,
      repeatMode: this.repeatMode,
      playbackNotice: this.playbackNotice,
      autoplayBlocked: this.autoplayBlocked,
    };
  }

  private emit(): void {
    const snap = this.getSnapshot();
    this.listeners.forEach((fn) => fn(snap));
  }

  private trackSourceKey(track: MusicTrack): string {
    return `${track.id}:${track.audioType ?? 'url'}:${track.audioVersion ?? 1}:${track.src}`;
  }

  private clearGestureResumeListener(): void {
    if (this.gestureResumeCleanup) {
      this.gestureResumeCleanup();
      this.gestureResumeCleanup = null;
    }
  }

  private attachGestureResumeListener(): void {
    if (typeof window === 'undefined' || this.gestureResumeCleanup) return;
    const handleGesture = () => {
      this.clearGestureResumeListener();
      if (!this.isPlaying && this.autoplayBlocked && this.playlist.length > 0) {
        void this.play();
      }
    };
    window.addEventListener('pointerdown', handleGesture, { passive: true });
    window.addEventListener('keydown', handleGesture, { passive: true });
    this.gestureResumeCleanup = () => {
      window.removeEventListener('pointerdown', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }

  private ensureHtmlAudio(): HTMLAudioElement {
    if (this.htmlAudio) return this.htmlAudio;
    const audio = new Audio();
    audio.preload = 'auto';
    audio.loop = false;

    audio.addEventListener('loadedmetadata', () => {
      if (this.htmlAudio !== audio || !audio.getAttribute('src')) return;
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        this.duration = audio.duration;
        this.emit();
      }
    });
    audio.addEventListener('timeupdate', () => {
      if (this.htmlAudio !== audio || !audio.getAttribute('src')) return;
      this.currentTime = audio.currentTime;
      this.emit();
    });
    audio.addEventListener('ended', () => {
      if (this.htmlAudio !== audio || !audio.getAttribute('src')) return;
      this.handleTrackEnded();
    });
    audio.addEventListener('error', () => {
      if (this.htmlAudio !== audio || !audio.getAttribute('src')) return;
      this.isPlaying = false;
      this.isLoadingTrack = false;
      this.playbackNotice =
        'Không thể phát tệp âm thanh này. Vui lòng kiểm tra lại tệp nhạc.';
      this.emit();
    });

    this.htmlAudio = audio;
    return audio;
  }

  private resetHtmlAudioSource(): void {
    if (this.htmlAudio) {
      try {
        this.htmlAudio.pause();
        this.htmlAudio.removeAttribute('src');
        this.htmlAudio.load();
      } catch {
        // Ignore cleanup errors
      }
      this.loadedTrackKey = null;
    }
  }

  /**
   * Primes the single reusable HTMLAudioElement inside a user gesture and
   * warms up the first track's audio source so playback can begin seamlessly.
   */
  public unlock(): void {
    if (typeof window === 'undefined') return;
    const audio = this.ensureHtmlAudio();
    if (!audio.getAttribute('src')) {
      try {
        audio.load();
      } catch {
        // Ignore noop load errors
      }
    }
    const track = this.getTrack();
    if (track && track.audioType === 'chunks') {
      void this.resolvePlayableUrl(track).catch(() => {
        // Handled during play()
      });
    }
  }

  /**
   * Called directly from the Welcome Screen enter click handler so background
   * music starts immediately as the Loading Screen appears, preserving the
   * browser's transient user gesture activation and continuing uninterrupted
   * into the Main Website using the single HTMLAudioElement instance.
   */
  public startAutoplayFromGesture(): void {
    this.unlock();

    // Never restart or duplicate audio if already actively playing
    if (this.isPlaying) {
      this.pendingAutoplay = false;
      return;
    }

    if (this.playlist.length === 0) {
      // Tracks are still arriving from Firestore; auto-start as soon as they arrive
      this.pendingAutoplay = true;
      return;
    }

    this.pendingAutoplay = false;
    void this.play();
  }

  /**
   * Resolves once the initial track has either started playing, reached ready
   * metadata, been blocked by browser policy, or hit a safe cap so the Loading
   * Screen reflects genuine audio initialization without ever freezing.
   */
  public waitForInitialAudioReady(timeoutMs = 2000): Promise<void> {
    if (this.playlist.length === 0 || this.isPlaying || this.autoplayBlocked) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        unsub();
        resolve();
      };

      const timer = window.setTimeout(done, timeoutMs);
      const unsub = this.subscribe((snap) => {
        if (
          snap.isPlaying ||
          snap.autoplayBlocked ||
          snap.playlist.length === 0 ||
          (!snap.isLoadingTrack && snap.playbackNotice !== null)
        ) {
          done();
        }
      });
    });
  }

  /**
   * Syncs real Admin-managed tracks from Firestore into the active playlist.
   * Never injects placeholder tracks or demo synth audio when empty.
   */
  public setPlaylist(dbTracks: MusicTrack[]): void {
    const prevTrack = this.getTrack();
    const prevKey = prevTrack ? this.trackSourceKey(prevTrack) : null;
    const wasPlaying = this.isPlaying;

    const nextPlaylist = this.transientDriveTrack
      ? [this.transientDriveTrack, ...dbTracks]
      : [...dbTracks];

    this.playlist = nextPlaylist;

    if (nextPlaylist.length === 0) {
      if (prevTrack) {
        revokeCachedTrackAudio(prevTrack.id);
      }
      this.playRequestSeq += 1;
      this.resetHtmlAudioSource();
      this.trackIndex = 0;
      this.isPlaying = false;
      this.isLoadingTrack = false;
      this.autoplayBlocked = false;
      this.clearGestureResumeListener();
      this.currentTime = 0;
      this.duration = 0;
      this.playbackNotice = wasPlaying
        ? 'Bài hát đang phát đã bị xóa. Hiện chưa có bài hát nào trong danh sách.'
        : null;
      this.emit();
      return;
    }

    if (!prevTrack) {
      this.trackIndex = 0;
      this.currentTime = 0;
      this.duration = nextPlaylist[0]?.duration || 0;
      this.playbackNotice = null;
      this.emit();

      // Pre-warm first track silently if chunk-based so click-to-load is instant
      const firstTrack = nextPlaylist[0];
      if (firstTrack && firstTrack.audioType === 'chunks') {
        void this.resolvePlayableUrl(firstTrack).catch(() => {
          // Handled when play() is triggered
        });
      }

      if (this.pendingAutoplay && !this.isPlaying && !this.isLoadingTrack) {
        this.pendingAutoplay = false;
        void this.play();
      }
      return;
    }

    const nextIdx = nextPlaylist.findIndex((t) => t.id === prevTrack.id);

    if (nextIdx >= 0) {
      this.trackIndex = nextIdx;
      const updatedTrack = nextPlaylist[nextIdx];
      const nextKey = this.trackSourceKey(updatedTrack);

      if (prevKey !== nextKey) {
        this.playRequestSeq += 1;
        this.resetHtmlAudioSource();
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

    // Currently active track was removed -> stop cleanly & switch safely without errors
    revokeCachedTrackAudio(prevTrack.id);
    this.playRequestSeq += 1;
    this.resetHtmlAudioSource();
    this.isPlaying = false;
    this.isLoadingTrack = false;
    this.currentTime = 0;
    this.trackIndex = Math.min(this.trackIndex, nextPlaylist.length - 1);
    this.duration = nextPlaylist[this.trackIndex]?.duration || 0;
    this.playbackNotice = wasPlaying
      ? 'Bài hát đang phát vừa được gỡ khỏi danh sách.'
      : null;
    this.emit();
  }

  private handleTrackEnded(): void {
    if (this.playlist.length === 0) {
      this.isPlaying = false;
      this.emit();
      return;
    }

    if (this.repeatMode === 'one') {
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

    if (this.repeatMode === 'off') {
      if (this.trackIndex < this.playlist.length - 1) {
        this.selectTrack(this.trackIndex + 1, true);
      } else {
        this.isPlaying = false;
        this.currentTime = 0;
        if (this.htmlAudio) {
          try {
            this.htmlAudio.pause();
            this.htmlAudio.currentTime = 0;
          } catch {
            // Ignore reset errors
          }
        }
        this.emit();
      }
      return;
    }

    // repeatMode === 'all'
    if (this.playlist.length === 1) {
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
    if (!track) {
      this.isPlaying = false;
      this.isLoadingTrack = false;
      this.emit();
      return;
    }

    const reqSeq = ++this.playRequestSeq;
    this.playbackNotice = null;
    this.autoplayBlocked = false;
    this.clearGestureResumeListener();
    const sourceKey = this.trackSourceKey(track);

    try {
      if (!this.htmlAudio || this.loadedTrackKey !== sourceKey) {
        this.isLoadingTrack = true;
        this.emit();

        const playableUrl = await this.resolvePlayableUrl(track);
        if (reqSeq !== this.playRequestSeq) return;
        if (!playableUrl) {
          throw new Error('Không tìm thấy tệp âm thanh cho bài hát này.');
        }

        const audio = this.ensureHtmlAudio();
        audio.pause();
        audio.src = playableUrl;
        audio.volume = this.isMuted ? 0 : this.volume;
        audio.currentTime = 0;
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
      this.autoplayBlocked = false;
      this.playbackNotice = null;
      this.emit();
    } catch (err) {
      if (reqSeq !== this.playRequestSeq) return;
      this.isLoadingTrack = false;
      this.isPlaying = false;

      const isAutoplayBlocked =
        err instanceof DOMException && err.name === 'NotAllowedError';
      this.autoplayBlocked = isAutoplayBlocked;
      if (isAutoplayBlocked) {
        this.attachGestureResumeListener();
      }
      this.playbackNotice = isAutoplayBlocked
        ? 'Trình duyệt tạm chặn tự động phát. Nhấn nút Phát để bật nhạc nền.'
        : err instanceof Error
          ? err.message
          : 'Không thể phát bài hát này.';
      this.emit();
    }
  }

  public pause(): void {
    this.pendingAutoplay = false;
    this.autoplayBlocked = false;
    this.clearGestureResumeListener();
    this.playRequestSeq += 1;
    this.isLoadingTrack = false;
    if (this.htmlAudio) {
      this.htmlAudio.pause();
    }
    this.isPlaying = false;
    this.emit();
  }

  public togglePlay(): void {
    if (this.playlist.length === 0) return;
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
    if (this.htmlAudio) {
      this.htmlAudio.volume = this.isMuted ? 0 : this.volume;
    }
    this.emit();
  }

  public toggleMute(): void {
    this.isMuted = !this.isMuted;
    if (this.htmlAudio) {
      this.htmlAudio.volume = this.isMuted ? 0 : this.volume;
    }
    this.emit();
  }

  public seek(targetSeconds: number): void {
    if (!this.htmlAudio || this.playlist.length === 0) return;
    const clamped = Math.max(0, Math.min(this.duration || 0, targetSeconds));
    this.currentTime = clamped;
    try {
      this.htmlAudio.currentTime = clamped;
    } catch {
      // Ignore seek before metadata loaded
    }
    this.emit();
  }

  public setCustomTrack(title: string, artist: string, src: string): void {
    const customTrack: MusicTrack = {
      id: `drive-${Date.now()}`,
      title,
      artist,
      src,
      cover: '',
      duration: 0,
      audioType: 'url',
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
    this.resetHtmlAudioSource();
    this.isPlaying = false;
    this.isLoadingTrack = false;
    this.autoplayBlocked = false;
    this.trackIndex = safeIdx;
    this.currentTime = 0;
    this.playbackNotice = null;
    this.duration = this.playlist[safeIdx]?.duration ?? 0;
    this.emit();

    if (wasPlaying) {
      void this.play();
    }
  }

  public nextTrack(autoplay?: boolean): void {
    if (this.playlist.length <= 1) return;
    this.selectTrack(this.trackIndex + 1, autoplay);
  }

  public prevTrack(autoplay?: boolean): void {
    if (this.playlist.length <= 1) return;
    this.selectTrack(this.trackIndex - 1, autoplay);
  }
}

export const musicPlayer = new BackgroundMusicEngine();
