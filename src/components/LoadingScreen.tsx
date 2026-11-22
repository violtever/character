import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ARCHIVE_META } from '../config/mediaConfig';
import type { ThemeMode } from '../types/archive';
import { sfx } from '../utils/sfxEngine';
import { BrandWordmark } from './BrandWordmark';

interface LoadingScreenProps {
  theme: ThemeMode;
  recordCount: number;
  onComplete: () => void;
}

function getLoadingStageMessage(progress: number): string {
  if (progress < 22) return 'Đang khởi tạo kho lưu trữ...';
  if (progress < 48) return 'Đang thu thập hồ sơ nhân vật...';
  if (progress < 74) return 'Đang sắp xếp danh mục thư viện...';
  if (progress < 98) return 'Đang chuẩn bị góc nhỏ của bạn...';
  return 'Kho lưu trữ đã sẵn sàng.';
}

export function LoadingScreen({
  theme,
  recordCount,
  onComplete,
}: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const totalDuration = prefersReducedMotion ? 850 : 2250;
    const startTime = performance.now();
    let rafId = 0;
    let holdTimer: number | null = null;
    let finished = false;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(1, elapsed / totalDuration);
      const eased =
        t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const nextValue = Math.round(eased * 100);
      setProgress(nextValue);

      if (t < 1) {
        rafId = window.requestAnimationFrame(tick);
      } else if (!finished) {
        finished = true;
        setProgress(100);
        setCompleted(true);
        sfx.play('loadingComplete');
        holdTimer = window.setTimeout(() => {
          onComplete();
        }, 480);
      }
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      if (holdTimer !== null) {
        window.clearTimeout(holdTimer);
      }
    };
  }, [onComplete]);

  const statusText = getLoadingStageMessage(progress);
  const ringRadius = 36;
  const circumference = 2 * Math.PI * ringRadius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <motion.section
      key="loading-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.985 }}
      transition={{ duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
      className="theme-surface archive-backdrop-light relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[var(--bg-canvas)] px-6 text-[var(--ink-primary)]"
    >
      {/* Subtle scanning beam */}
      <div
        aria-hidden="true"
        className="animate-scan-sweep pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{
          background:
            theme === 'dark'
              ? 'linear-gradient(90deg, transparent, rgba(207, 59, 87, 0.7), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(37, 88, 212, 0.45), transparent)',
        }}
      />

      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-5 border sm:inset-8 ${
          theme === 'light'
            ? 'rounded-[1.75rem] border-dashed border-[var(--border-strong)]/55'
            : 'border-[var(--border-hairline)]'
        }`}
      />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        {/* Circular progress ring */}
        <div className="relative mb-8 flex h-24 w-24 items-center justify-center">
          <svg
            className="h-24 w-24 -rotate-90"
            viewBox="0 0 88 88"
            aria-hidden="true"
          >
            <circle
              cx="44"
              cy="44"
              r={ringRadius}
              fill="none"
              stroke="var(--border-hairline)"
              strokeWidth="1.8"
            />
            <circle
              cx="44"
              cy="44"
              r={ringRadius}
              fill="none"
              stroke="var(--accent-primary)"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
            />
          </svg>

          <motion.div
            animate={completed ? { rotate: 0, scale: 1.05 } : { rotate: 360 }}
            transition={
              completed
                ? { duration: 0.4 }
                : { duration: 9, repeat: Infinity, ease: 'linear' }
            }
            className="absolute inset-4 rounded-full border border-dashed border-[var(--border-strong)]"
            aria-hidden="true"
          />

          <span className="font-mono-archive text-base font-medium text-[var(--ink-primary)]">
            {progress}%
          </span>
        </div>

        <p className="font-mono-archive text-[11px] tracking-[0.2em] text-[var(--ink-muted)] uppercase">
          {ARCHIVE_META.archiveNumber} · {recordCount} hồ sơ
        </p>

        <div className="mt-3">
          <BrandWordmark theme={theme} size="md" centered />
        </div>

        {/* Progress bar */}
        <div className="mt-8 w-full">
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Tiến độ tải thư viện"
            className="relative h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-hairline)]"
          >
            <div
              className="h-full w-full origin-left rounded-full bg-[var(--accent-primary)] transition-transform duration-100 ease-out"
              style={{ transform: `scaleX(${progress / 100})` }}
            />
          </div>

          <div className="mt-4 flex items-center justify-between text-xs text-[var(--ink-secondary)]">
            <motion.span
              key={statusText}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24 }}
              className="truncate pr-3"
            >
              {statusText}
            </motion.span>
            <span className="font-mono-archive shrink-0 text-[var(--ink-muted)]">
              {String(progress).padStart(3, '0')} / 100
            </span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
