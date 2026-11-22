import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronDown,
  ChevronUp,
  Music,
  Pause,
  Play,
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

  const progressRatio =
    snapshot.duration > 0
      ? Math.min(100, (snapshot.currentTime / snapshot.duration) * 100)
      : 0;

  return (
    <aside
      aria-label="Trình phát nhạc nền"
      className="fixed right-4 bottom-4 z-40 w-[min(calc(100vw-2rem),340px)] sm:right-6 sm:bottom-6"
    >
      <div className="theme-card theme-surface overflow-hidden border border-[var(--border-strong)] bg-[var(--bg-surface)]/95 shadow-xl backdrop-blur-md">
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
            <p className="font-mono-archive mt-0.5 truncate text-[11px] text-[var(--ink-muted)]">
              {formatTimeClock(snapshot.currentTime)} /{' '}
              {formatTimeClock(snapshot.duration)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => {
                sfx.unlock();
                musicPlayer.togglePlay();
              }}
              aria-label={snapshot.isPlaying ? 'Tạm dừng nhạc nền' : 'Phát nhạc nền'}
              className="theme-control flex h-9 w-9 items-center justify-center bg-[var(--accent-primary)] text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]"
            >
              {snapshot.isPlaying ? (
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

        <div className="h-[2px] w-full bg-[var(--border-hairline)]">
          <div
            className="h-full origin-left bg-[var(--accent-primary)] transition-transform duration-300"
            style={{ transform: `scaleX(${progressRatio / 100})` }}
          />
        </div>

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
                <div className="flex items-center justify-between text-[11px] text-[var(--ink-muted)]">
                  <span className="truncate">{snapshot.track.artist}</span>
                  <span className="font-mono-archive shrink-0">
                    {snapshot.usingCustomFile ? 'Nhạc tùy chỉnh' : 'Nhạc nền lưu trữ'}
                  </span>
                </div>

                <div>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(1, Math.floor(snapshot.duration))}
                    value={Math.floor(snapshot.currentTime)}
                    onChange={(e) => musicPlayer.seek(Number(e.target.value))}
                    aria-label="Tua thời gian bài hát"
                    className="archive-range w-full"
                  />
                  <div className="font-mono-archive mt-1 flex justify-between text-[10px] text-[var(--ink-muted)]">
                    <span>{formatTimeClock(snapshot.currentTime)}</span>
                    <span>{formatTimeClock(snapshot.duration)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 pt-0.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        sfx.play('filterSelect');
                        musicPlayer.prevTrack();
                      }}
                      aria-label="Bài trước"
                      className="theme-control flex h-8 w-8 items-center justify-center border border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
                    >
                      <SkipBack className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        sfx.play('filterSelect');
                        musicPlayer.nextTrack();
                      }}
                      aria-label="Bài tiếp theo"
                      className="theme-control flex h-8 w-8 items-center justify-center border border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
                    >
                      <SkipForward className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-1 items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => musicPlayer.toggleMute()}
                      aria-label={snapshot.isMuted ? 'Bật tiếng nhạc' : 'Tắt tiếng nhạc'}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
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
                      className="archive-range w-24"
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
