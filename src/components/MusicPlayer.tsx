import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronDown,
  ChevronUp,
  ListMusic,
  Loader2,
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { MusicSnapshot } from '../utils/musicEngine';
import { musicPlayer } from '../utils/musicEngine';
import { sfx } from '../utils/sfxEngine';
import { formatTimeClock } from '../utils/urlSafety';

interface MusicPlayerProps {
  snapshot: MusicSnapshot;
}

export function MusicPlayer({ snapshot }: MusicPlayerProps) {
  const [expanded, setExpanded] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);

  const progressRatio =
    snapshot.duration > 0
      ? Math.min(100, (snapshot.currentTime / snapshot.duration) * 100)
      : 0;

  const repeatLabel =
    snapshot.repeatMode === 'one'
      ? 'Lặp 1 bài'
      : snapshot.repeatMode === 'all'
        ? 'Lặp danh sách'
        : 'Không lặp';

  return (
    <aside
      aria-label="Trình phát nhạc nền"
      className="fixed right-4 bottom-4 z-40 w-[min(calc(100vw-2rem),360px)] sm:right-6 sm:bottom-6"
    >
      <div className="theme-card theme-surface overflow-hidden border border-[var(--border-strong)] bg-[var(--bg-surface)]/95 shadow-xl backdrop-blur-md">
        {/* Compact Header Bar */}
        <div className="flex items-center gap-3 px-3.5 py-2.5">
          <div className="theme-control relative h-10 w-10 shrink-0 overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-elevated)]">
            {snapshot.track.cover ? (
              <img
                src={snapshot.track.cover}
                alt={snapshot.track.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[var(--accent-primary)]">
                <Music className="h-4 w-4" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-xs font-semibold text-[var(--ink-primary)]">
                {snapshot.track.title}
              </p>
              <div
                aria-hidden="true"
                className="flex h-3 shrink-0 items-end gap-[2px]"
              >
                {[0.45, 0.9, 0.65, 1].map((scale, i) => (
                  <motion.span
                    key={i}
                    animate={
                      snapshot.isPlaying && !snapshot.isMuted
                        ? {
                            scaleY: [0.3, scale, 0.4, 0.85, 0.3],
                          }
                        : { scaleY: 0.25 }
                    }
                    transition={
                      snapshot.isPlaying && !snapshot.isMuted
                        ? {
                            duration: 0.95 + i * 0.16,
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }
                        : { duration: 0.2 }
                    }
                    className="h-full w-[2px] origin-bottom rounded-full bg-[var(--accent-primary)]"
                  />
                ))}
              </div>
            </div>
            <p className="truncate text-[11px] text-[var(--ink-muted)]">
              {snapshot.track.artist}
              <span className="font-mono-archive">
                {' '}
                · {formatTimeClock(snapshot.currentTime)} /{' '}
                {formatTimeClock(snapshot.duration)}
              </span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                sfx.unlock();
                musicPlayer.togglePlay();
              }}
              aria-label={
                snapshot.isLoadingTrack
                  ? 'Đang tải bài hát'
                  : snapshot.isPlaying
                    ? 'Tạm dừng nhạc nền'
                    : 'Phát nhạc nền'
              }
              className="theme-control flex h-9 w-9 items-center justify-center bg-[var(--accent-primary)] text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]"
            >
              {snapshot.isLoadingTrack ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : snapshot.isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 translate-x-[1px]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                sfx.play('filterSelect');
                setExpanded((prev) => !prev);
              }}
              aria-label={
                expanded ? 'Thu gọn trình phát nhạc' : 'Mở rộng trình phát nhạc'
              }
              aria-expanded={expanded}
              className="theme-control flex h-9 w-8 items-center justify-center text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
            >
              {expanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Hairline Progress Bar */}
        <div className="h-[2px] w-full bg-[var(--border-hairline)]">
          <div
            className="h-full origin-left bg-[var(--accent-primary)] transition-transform duration-300"
            style={{ transform: `scaleX(${progressRatio / 100})` }}
          />
        </div>

        {/* Expanded Controls + Playlist Drawer */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="space-y-3 border-t border-[var(--border-hairline)] px-4 py-3.5">
                {/* Artist & Source Meta */}
                <div className="flex items-center justify-between gap-2 text-[11px] text-[var(--ink-muted)]">
                  <span className="truncate font-medium text-[var(--ink-secondary)]">
                    {snapshot.track.artist}
                  </span>
                  <span className="font-mono-archive shrink-0">
                    {snapshot.trackIndex + 1}/{snapshot.playlist.length} ·{' '}
                    {snapshot.usingCustomFile ? 'Thư viện nhạc' : 'Giai điệu lưu trữ'}
                  </span>
                </div>

                {snapshot.track.description && (
                  <p className="line-clamp-2 text-[11px] leading-relaxed text-[var(--ink-muted)]">
                    {snapshot.track.description}
                  </p>
                )}

                {snapshot.playbackNotice && (
                  <div className="theme-control border border-[var(--border-strong)] bg-[var(--accent-soft)]/50 px-2.5 py-1.5 text-[11px] text-[var(--ink-primary)]">
                    {snapshot.playbackNotice}
                  </div>
                )}

                {/* Progress Seek Slider */}
                <div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(1, Math.floor(snapshot.duration))}
                    value={Math.min(
                      Math.max(1, Math.floor(snapshot.duration)),
                      Math.floor(snapshot.currentTime)
                    )}
                    onChange={(e) => musicPlayer.seek(Number(e.target.value))}
                    aria-label="Tua thời gian bài hát"
                    className="archive-range w-full"
                  />
                  <div className="font-mono-archive mt-1 flex justify-between text-[10px] text-[var(--ink-muted)]">
                    <span>{formatTimeClock(snapshot.currentTime)}</span>
                    <span>{formatTimeClock(snapshot.duration)}</span>
                  </div>
                </div>

                {/* Transport, Repeat, Playlist & Volume Row */}
                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        sfx.play('filterSelect');
                        musicPlayer.prevTrack();
                      }}
                      disabled={snapshot.playlist.length <= 1}
                      aria-label="Bài trước"
                      title="Bài trước"
                      className="theme-control flex h-8 w-8 items-center justify-center border border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)] disabled:opacity-40"
                    >
                      <SkipBack className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        sfx.play('filterSelect');
                        musicPlayer.nextTrack();
                      }}
                      disabled={snapshot.playlist.length <= 1}
                      aria-label="Bài tiếp theo"
                      title="Bài tiếp theo"
                      className="theme-control flex h-8 w-8 items-center justify-center border border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)] disabled:opacity-40"
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        sfx.play('filterSelect');
                        musicPlayer.toggleRepeatMode();
                      }}
                      aria-label={`Chế độ lặp: ${repeatLabel}`}
                      title={`Chế độ lặp: ${repeatLabel}`}
                      className={`theme-control flex h-8 w-8 items-center justify-center border transition-colors ${
                        snapshot.repeatMode === 'off'
                          ? 'border-[var(--border-hairline)] text-[var(--ink-muted)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]'
                          : 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                      }`}
                    >
                      {snapshot.repeatMode === 'one' ? (
                        <Repeat1 className="h-3.5 w-3.5" />
                      ) : (
                        <Repeat className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        sfx.play('filterSelect');
                        setShowPlaylist((v) => !v);
                      }}
                      aria-label={
                        showPlaylist
                          ? 'Ẩn danh sách phát'
                          : 'Mở danh sách phát'
                      }
                      title="Danh sách phát"
                      aria-expanded={showPlaylist}
                      className={`theme-control flex h-8 w-8 items-center justify-center border transition-colors ${
                        showPlaylist
                          ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
                          : 'border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]'
                      }`}
                    >
                      <ListMusic className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => musicPlayer.toggleMute()}
                      aria-label={
                        snapshot.isMuted ? 'Bật tiếng nhạc' : 'Tắt tiếng nhạc'
                      }
                      className="flex h-8 w-7 items-center justify-center rounded-md text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
                    >
                      {snapshot.isMuted || snapshot.volume === 0 ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={snapshot.isMuted ? 0 : snapshot.volume}
                      onChange={(e) =>
                        musicPlayer.setVolume(Number(e.target.value))
                      }
                      aria-label="Âm lượng nhạc nền"
                      className="archive-range w-20"
                    />
                  </div>
                </div>

                {/* Collapsible Playlist Queue */}
                <AnimatePresence initial={false}>
                  {showPlaylist && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden border-t border-[var(--border-hairline)] pt-2.5"
                    >
                      <div className="mb-1.5 flex items-center justify-between text-[10px] tracking-wider text-[var(--ink-muted)] uppercase">
                        <span className="font-mono-archive">
                          Danh sách phát ({snapshot.playlist.length})
                        </span>
                        <span className="font-mono-archive">{repeatLabel}</span>
                      </div>

                      <div className="max-h-44 space-y-1 overflow-y-auto pr-1">
                        {snapshot.playlist.map((item, idx) => {
                          const active = item.id === snapshot.track.id;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => {
                                sfx.unlock();
                                musicPlayer.playTrackById(item.id);
                              }}
                              className={`theme-control flex w-full items-center gap-2.5 px-2 py-1.5 text-left transition-colors ${
                                active
                                  ? 'border border-[var(--accent-primary)]/50 bg-[var(--accent-soft)]/70 text-[var(--ink-primary)]'
                                  : 'border border-transparent hover:bg-[var(--bg-subtle)] text-[var(--ink-secondary)]'
                              }`}
                            >
                              <div className="h-7 w-7 shrink-0 overflow-hidden rounded border border-[var(--border-hairline)] bg-[var(--bg-elevated)]">
                                {item.cover ? (
                                  <img
                                    src={item.cover}
                                    alt={item.title}
                                    referrerPolicy="no-referrer"
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[var(--accent-primary)]">
                                    <Music className="h-3 w-3" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium text-[var(--ink-primary)]">
                                  {idx + 1}. {item.title}
                                </p>
                                <p className="truncate text-[10px] text-[var(--ink-muted)]">
                                  {item.artist}
                                </p>
                              </div>
                              <span className="font-mono-archive shrink-0 text-[10px] text-[var(--ink-muted)]">
                                {item.duration > 0
                                  ? formatTimeClock(item.duration)
                                  : '--:--'}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
