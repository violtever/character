import { motion } from 'motion/react';
import { Check, Loader2, Music, Play } from 'lucide-react';
import { ARCHIVE_META } from '../config/mediaConfig';
import type { ThemeMode } from '../types/archive';
import { musicPlayer, type MusicSnapshot } from '../utils/musicEngine';
import { BrandWordmark } from './BrandWordmark';
import { ParticleField } from './ParticleField';
import { FloatingDreamyStickers } from './ThemeDecorations';

export interface LoadingTaskItem {
  id: string;
  label: string;
  done: boolean;
}

interface LoadingScreenProps {
  theme: ThemeMode;
  progress: number;
  statusLabel: string;
  tasks: LoadingTaskItem[];
  isComplete: boolean;
  musicSnapshot: MusicSnapshot;
}

export function LoadingScreen({
  theme,
  progress,
  statusLabel,
  tasks,
  isComplete,
  musicSnapshot,
}: LoadingScreenProps) {
  const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));
  const ringRadius = 40;
  const circumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = circumference - (safeProgress / 100) * circumference;

  const activeTrack = musicSnapshot.track;
  const hasPlaylist = musicSnapshot.playlist.length > 0 && activeTrack !== null;

  return (
    <motion.section
      key="loading-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
      className="theme-surface archive-backdrop-light relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[var(--bg-canvas)] px-6 py-10 text-[var(--ink-primary)]"
    >
      {/* Subtle theme background motifs & ambient particle atmosphere */}
      <FloatingDreamyStickers theme={theme} />

      <div className="pointer-events-none absolute inset-0 z-0">
        <ParticleField theme={theme} density={38} />
      </div>

      {/* Centered breathing aura */}
      <div
        aria-hidden="true"
        className="animate-ambient-breath pointer-events-none absolute top-1/2 left-1/2 h-[30rem] w-[38rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            theme === 'dark'
              ? 'radial-gradient(ellipse at center, rgba(181, 43, 68, 0.24) 0%, rgba(74, 14, 26, 0.1) 52%, transparent 74%)'
              : 'radial-gradient(ellipse at center, rgba(168, 206, 255, 0.48) 0%, rgba(235, 208, 248, 0.28) 52%, transparent 74%)',
        }}
      />

      {/* Subtle scanning light hairline */}
      <div
        aria-hidden="true"
        className="animate-scan-sweep pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            theme === 'dark'
              ? 'linear-gradient(90deg, transparent, rgba(207, 59, 87, 0.72), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(37, 88, 212, 0.48), transparent)',
        }}
      />

      {/* Outer atmospheric frame */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-4 z-10 border sm:inset-7 ${
          theme === 'light'
            ? 'rounded-[1.75rem] border-dashed border-[var(--border-strong)]/55'
            : 'border-[var(--border-hairline)]'
        }`}
      >
        {theme === 'dark' && (
          <>
            <span className="absolute -top-px -left-px h-4 w-4 border-t border-l border-[var(--accent-primary)]" />
            <span className="absolute -top-px -right-px h-4 w-4 border-t border-r border-[var(--accent-primary)]" />
            <span className="absolute -bottom-px -left-px h-4 w-4 border-b border-l border-[var(--accent-primary)]" />
            <span className="absolute -bottom-px -right-px h-4 w-4 border-b border-r border-[var(--accent-primary)]" />
          </>
        )}
      </div>

      <div className="relative z-20 flex w-full max-w-md flex-col items-center text-center">
        {/* Reactive orbital progress ring */}
        <div className="relative mb-7 flex h-28 w-28 items-center justify-center">
          <div
            aria-hidden="true"
            className="animate-soft-beacon pointer-events-none absolute inset-1 rounded-full blur-xl"
            style={{
              background:
                theme === 'dark'
                  ? 'radial-gradient(circle, rgba(181, 43, 68, 0.28) 0%, transparent 72%)'
                  : 'radial-gradient(circle, rgba(37, 88, 212, 0.18) 0%, rgba(226, 128, 167, 0.16) 55%, transparent 76%)',
            }}
          />

          <svg
            className="h-28 w-28 -rotate-90"
            viewBox="0 0 96 96"
            aria-hidden="true"
          >
            <circle
              cx="48"
              cy="48"
              r={ringRadius}
              fill="none"
              stroke="var(--border-hairline)"
              strokeWidth="1.8"
            />
            <circle
              cx="48"
              cy="48"
              r={ringRadius}
              fill="none"
              stroke="var(--accent-primary)"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                transition: 'stroke-dashoffset 260ms cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          </svg>

          {/* Outer slow orbital ring */}
          <motion.div
            animate={isComplete ? { rotate: 0, scale: 1.04 } : { rotate: 360 }}
            transition={
              isComplete
                ? { duration: 0.35 }
                : { duration: 10, repeat: Infinity, ease: 'linear' }
            }
            className="absolute inset-4 rounded-full border border-dashed border-[var(--border-strong)]"
            aria-hidden="true"
          />

          {/* Counter-rotating inner delicate ring */}
          <motion.div
            animate={isComplete ? { rotate: 0 } : { rotate: -360 }}
            transition={
              isComplete
                ? { duration: 0.35 }
                : { duration: 14, repeat: Infinity, ease: 'linear' }
            }
            className="absolute inset-6 rounded-full border border-dotted border-[var(--accent-secondary)]/55"
            aria-hidden="true"
          />

          <span className="font-mono-archive relative text-base font-semibold tabular-nums text-[var(--ink-primary)]">
            {safeProgress}%
          </span>
        </div>

        <p className="font-mono-archive text-[11px] tracking-[0.22em] text-[var(--ink-muted)] uppercase">
          {ARCHIVE_META.archiveNumber} · {ARCHIVE_META.collectionLabel}
        </p>

        <div className="mt-2.5">
          <BrandWordmark theme={theme} size="md" centered />
        </div>

        {/* Real Progress Bar with Shimmer */}
        <div className="mt-7 w-full">
          <div
            role="progressbar"
            aria-valuenow={safeProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Tiến độ khởi tạo thư viện"
            className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-hairline)]"
          >
            <div
              className="relative h-full w-full origin-left overflow-hidden rounded-full bg-[var(--accent-primary)] transition-transform duration-300 ease-out"
              style={{ transform: `scaleX(${safeProgress / 100})` }}
            >
              {!isComplete && (
                <span
                  aria-hidden="true"
                  className="animate-shimmer-sweep pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent"
                />
              )}
            </div>
          </div>

          <div className="mt-3.5 flex items-center justify-between text-xs text-[var(--ink-secondary)]">
            <motion.span
              key={statusLabel}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              className="truncate pr-3"
            >
              {statusLabel}
            </motion.span>
            <span className="font-mono-archive shrink-0 text-[var(--ink-muted)]">
              {String(safeProgress).padStart(3, '0')} / 100
            </span>
          </div>
        </div>

        {/* Real Initialization Checklist (reflects actual completed steps) */}
        <div className="theme-card mt-6 w-full border border-[var(--border-hairline)] bg-[var(--bg-surface)]/80 px-4 py-3.5 text-left backdrop-blur-md">
          <ul className="space-y-2">
            {tasks.map((task) => (
              <li
                key={task.id}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <span
                  className={`truncate transition-colors duration-200 ${
                    task.done
                      ? 'text-[var(--ink-primary)]'
                      : 'text-[var(--ink-muted)]'
                  }`}
                >
                  {task.label}
                </span>
                <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                  {task.done ? (
                    <Check className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                  ) : (
                    <Loader2 className="h-3 w-3 animate-spin text-[var(--ink-muted)]" />
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Live Background Music Status on Loading Screen */}
        {hasPlaylist && activeTrack && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="mt-5 flex items-center justify-center gap-2 text-xs text-[var(--ink-secondary)]"
          >
            {musicSnapshot.isPlaying ? (
              <>
                <div
                  aria-hidden="true"
                  className="flex h-3 shrink-0 items-end gap-[2px]"
                >
                  {[0.45, 0.95, 0.65, 1].map((scale, i) => (
                    <motion.span
                      key={i}
                      animate={{ scaleY: [0.3, scale, 0.4, 0.88, 0.3] }}
                      transition={{
                        duration: 0.9 + i * 0.14,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      }}
                      className="h-full w-[2px] origin-bottom rounded-full bg-[var(--accent-primary)]"
                    />
                  ))}
                </div>
                <span className="max-w-[260px] truncate">
                  Đang phát:{' '}
                  <strong className="font-medium text-[var(--ink-primary)]">
                    {activeTrack.title}
                  </strong>
                  {activeTrack.artist ? ` — ${activeTrack.artist}` : ''}
                </span>
              </>
            ) : musicSnapshot.autoplayBlocked ? (
              <button
                type="button"
                onClick={() => void musicPlayer.play()}
                className="theme-control btn-tactile inline-flex items-center gap-1.5 border border-[var(--border-strong)] bg-[var(--bg-surface)]/90 px-3 py-1.5 text-xs font-medium text-[var(--accent-primary)] hover:border-[var(--accent-primary)]"
              >
                <Play className="h-3 w-3 fill-current" />
                <span>Chạm để bật nhạc nền ({activeTrack.title})</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[var(--ink-muted)]">
                <Music className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                <span className="max-w-[260px] truncate">
                  Đang chuẩn bị nhạc nền: {activeTrack.title}
                </span>
              </span>
            )}
          </motion.div>
        )}
      </div>
    </motion.section>
  );
}
