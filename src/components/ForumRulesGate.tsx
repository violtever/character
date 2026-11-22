import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  HeartHandshake,
  Lock,
  MessageSquareWarning,
  ShieldCheck,
  Sparkles,
  UserCheck,
} from 'lucide-react';
import type { ForumRulesConfig, ThemeMode } from '../types/archive';
import { sfx } from '../utils/sfxEngine';

interface ForumRulesGateProps {
  theme: ThemeMode;
  config: ForumRulesConfig;
  isUpdatedVersion?: boolean;
  saving: boolean;
  onAccept: () => void;
  onBackToArchive: () => void;
}

const RULE_ICONS = [
  HeartHandshake,
  ShieldCheck,
  MessageSquareWarning,
  Sparkles,
  Lock,
  UserCheck,
];

export function ForumRulesGate({
  theme,
  config,
  isUpdatedVersion = false,
  saving,
  onAccept,
  onBackToArchive,
}: ForumRulesGateProps) {
  const [secondsLeft, setSecondsLeft] = useState(3);

  useEffect(() => {
    setSecondsLeft(3);
    const interval = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [config.version]);

  const progressPercent = ((3 - secondsLeft) / 3) * 100;
  const canConfirm = secondsLeft === 0 && !saving;

  return (
    <section className="relative z-10 mx-auto w-full max-w-3xl flex-1 px-5 py-10 sm:px-8 sm:py-14">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={`theme-panel relative overflow-hidden border bg-[var(--bg-surface)] p-6 shadow-xl sm:p-10 ${
          theme === 'light'
            ? 'border-[var(--border-strong)] shadow-[0_24px_56px_-24px_rgba(37,88,212,0.28)]'
            : 'border-[var(--border-strong)] shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)]'
        }`}
      >
        {/* Subtle top accent band */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-1.5"
          style={{
            background:
              theme === 'light'
                ? 'linear-gradient(90deg, #8ab4ff 0%, #2558d4 50%, #e280a7 100%)'
                : 'linear-gradient(90deg, #7d2336 0%, #b52b44 50%, #d9a79c 100%)',
          }}
        />

        {/* Header with charming mascot badge */}
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3.5">
            <div
              className={`theme-control flex h-14 w-14 shrink-0 items-center justify-center border ${
                theme === 'light'
                  ? 'border-[#7aa6f4]/50 bg-[#edf4ff] text-[#2558d4]'
                  : 'border-[#b52b44]/50 bg-[#251017] text-[#e895a5]'
              }`}
            >
              {/* Cute handbook + star emblem */}
              <svg
                viewBox="0 0 48 48"
                className="h-9 w-9"
                fill="none"
                aria-hidden="true"
              >
                <rect
                  x="9"
                  y="7"
                  width="30"
                  height="34"
                  rx="7"
                  fill="currentColor"
                  fillOpacity="0.14"
                  stroke="currentColor"
                  strokeWidth="2.4"
                />
                <path
                  d="M16 17h16M16 24h12M16 31h9"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />
                <path
                  d="M35 8l1.6 3.5L40 13l-3.4 1.5L35 18l-1.5-3.5L30 13l3.5-1.5L35 8z"
                  fill={theme === 'light' ? '#e280a7' : '#d9a79c'}
                />
              </svg>
            </div>
            <div>
              <p className="font-mono-archive text-xs tracking-[0.18em] text-[var(--ink-muted)] uppercase">
                Nội quy diễn đàn · Phiên bản v{config.version}
              </p>
              <h1 className="font-editorial mt-1 text-balance text-3xl font-semibold text-[var(--ink-primary)] sm:text-4xl">
                {config.title}
              </h1>
            </div>
          </div>
        </div>

        {isUpdatedVersion && (
          <div className="theme-control mt-5 border border-[var(--border-strong)] bg-[var(--accent-soft)] px-4 py-3 text-xs font-medium text-[var(--ink-primary)]">
            Nội quy diễn đàn vừa được Quản trị viên cập nhật lên phiên bản mới (v
            {config.version}). Vui lòng đọc qua và xác nhận lại để tiếp tục tham
            gia.
          </div>
        )}

        <p className="mt-5 text-sm leading-relaxed text-[var(--ink-secondary)]">
          {config.intro}
        </p>

        {/* Civil Community Rules List */}
        <ol className="mt-6 space-y-3">
          {config.rules.map((ruleText, idx) => {
            const IconComp = RULE_ICONS[idx % RULE_ICONS.length];
            return (
              <li
                key={idx}
                className="theme-control flex items-start gap-3.5 border border-[var(--border-hairline)] bg-[var(--bg-canvas)]/75 px-4 py-3.5"
              >
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                  <IconComp className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-mono-archive mr-2 text-[11px] font-semibold text-[var(--ink-muted)]">
                    0{idx + 1}.
                  </span>
                  <span className="text-sm leading-relaxed text-[var(--ink-primary)]">
                    {ruleText}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>

        {/* Friendly Enforcement Notice */}
        <div className="mt-6 border-t border-[var(--border-hairline)] pt-5 text-xs leading-relaxed text-[var(--ink-muted)]">
          Hệ thống kiểm duyệt tự động cùng Quản trị viên sẽ ghi nhận các hành vi
          vi phạm và áp dụng nhắc nhở tăng dần nhằm giữ không gian luôn thân thiện.
          Nếu có nhầm lẫn, bạn luôn có quyền gửi yêu cầu xem xét lại.
        </div>

        {/* Countdown Progress Bar */}
        <div className="mt-6">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-subtle)]">
            <div
              className="h-full rounded-full bg-[var(--accent-primary)] transition-[width] duration-700 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => {
              sfx.play('close');
              onBackToArchive();
            }}
            className="theme-control inline-flex h-11 items-center justify-center gap-2 border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-5 text-xs font-semibold whitespace-nowrap text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại thư viện</span>
          </button>

          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => {
              if (!canConfirm) return;
              sfx.play('welcomeClick');
              onAccept();
            }}
            className={`theme-control inline-flex h-11 items-center justify-center gap-2 px-6 text-xs font-semibold tracking-wider whitespace-nowrap uppercase ${
              canConfirm
                ? 'bg-[var(--accent-primary)] text-[var(--accent-ink)] shadow-md hover:bg-[var(--accent-hover)]'
                : 'cursor-not-allowed border border-[var(--border-hairline)] bg-[var(--bg-subtle)] text-[var(--ink-muted)]'
            }`}
          >
            {saving ? (
              <>
                <Clock className="h-4 w-4 animate-spin" />
                <span>Đang lưu xác nhận...</span>
              </>
            ) : secondsLeft > 0 ? (
              <>
                <Clock className="h-4 w-4" />
                <span className="font-mono-archive">
                  Vui lòng đọc nội quy ({secondsLeft}s)...
                </span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>ĐỒNG Ý VÀ TIẾP TỤC</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </section>
  );
}
