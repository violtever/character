import { useEffect, useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  CheckCircle2,
  Edit3,
  Loader2,
  Send,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { ModerationSeverity, ThemeMode } from '../types/archive';
import { getEscalationSummaryVi } from '../utils/contentModeration';
import { formatDeadlineVi } from '../services/moderationService';
import { sfx } from '../utils/sfxEngine';

export interface ModerationWarningPayload {
  violationId: string;
  strikeNumber: number;
  severity: ModerationSeverity;
  reason: string;
  matchedExcerpt: string;
  alreadyRecordedForDraft: boolean;
  restrictedUntil: number;
}

interface ModerationWarningModalProps {
  theme: ThemeMode;
  warning: ModerationWarningPayload;
  onEditContent: () => void;
  onClose: () => void;
  onSubmitAppeal: (violationId: string, appealReason: string) => Promise<void>;
}

/**
 * Custom cute chibi Police Officer sticker SVG (serious yet adorable expression,
 * glossy sticker outline, crisp at any resolution in both Light & Dark Mode).
 */
function CutePoliceOfficerSticker({ theme }: { theme: ThemeMode }) {
  const capFill = theme === 'light' ? '#2558d4' : '#3a1a28';
  const capTrim = theme === 'light' ? '#1b3e99' : '#612134';
  const uniformFill = theme === 'light' ? '#3a6fe8' : '#4a1d2d';
  const badgeGold = theme === 'light' ? '#fbbf24' : '#e6b873';
  const blush = theme === 'light' ? '#f497b6' : '#d98499';
  const stickerBorder = theme === 'light' ? '#ffffff' : '#2c131c';

  return (
    <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
      {/* Gentle beacon indicator (no harsh flashing, disabled under reduced-motion) */}
      <span
        aria-hidden="true"
        className="animate-soft-beacon absolute -top-0.5 right-3 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500/25"
      >
        <span className="h-2 w-2 rounded-full bg-rose-500" />
      </span>

      <svg
        viewBox="0 0 120 120"
        className="h-26 w-26 drop-shadow-[0_10px_18px_rgba(0,0,0,0.16)]"
        role="img"
        aria-label="Chú cảnh sát nhỏ nhắc nhở nội quy"
      >
        {/* Sticker backing */}
        <circle
          cx="60"
          cy="62"
          r="50"
          fill={stickerBorder}
          stroke={theme === 'light' ? '#c8dcff' : '#7d2336'}
          strokeWidth="2.5"
        />
        <circle
          cx="60"
          cy="62"
          r="44"
          fill={theme === 'light' ? '#edf4ff' : '#1c0c12'}
        />

        {/* Uniform shoulders */}
        <path
          d="M28 98c4-15 16-22 32-22s28 7 32 22c-9 7-20 10-32 10s-23-3-32-10z"
          fill={uniformFill}
        />
        {/* Crisp collar & tie */}
        <path d="M51 77l9 10 9-10-4-3h-10l-4 3z" fill="#ffffff" />
        <path d="M58 84l2 14 2-14-2-2-2 2z" fill={capTrim} />
        {/* Little chest badge */}
        <polygon
          points="74,85 75.8,88.4 79.5,89 76.8,91.5 77.4,95.2 74,93.4 70.6,95.2 71.2,91.5 68.5,89 72.2,88.4"
          fill={badgeGold}
        />

        {/* Cute head */}
        <circle cx="60" cy="56" r="24" fill="#ffe6d6" />
        {/* Hair fringe peeking under cap */}
        <path
          d="M37 49c3-8 12-13 23-13s20 5 23 13c-5-3-10-5-16-4-3-3-11-3-15 0-6-1-11 1-15 4z"
          fill="#3b2833"
        />

        {/* Police Cap */}
        <path
          d="M32 42c3-14 14-21 28-21s25 7 28 21l-4 4H36l-4-4z"
          fill={capFill}
        />
        {/* Cap visor */}
        <path d="M35 45c8 5 42 5 50 0-3 6-14 9-25 9s-22-3-25-9z" fill={capTrim} />
        {/* Cap gold star emblem */}
        <circle cx="60" cy="32" r="6" fill={badgeGold} />
        <polygon
          points="60,28 61.3,30.6 64.2,31 62.1,33 62.6,35.8 60,34.4 57.4,35.8 57.9,33 55.8,31 58.7,30.6"
          fill="#ffffff"
        />

        {/* Serious-yet-cute eyebrows */}
        <path
          d="M46 53l7 2.2M74 53l-7 2.2"
          stroke="#2d1d24"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        {/* Bright round eyes with catchlights */}
        <circle cx="50" cy="60" r="3.4" fill="#231820" />
        <circle cx="70" cy="60" r="3.4" fill="#231820" />
        <circle cx="48.8" cy="58.7" r="1.2" fill="#ffffff" />
        <circle cx="68.8" cy="58.7" r="1.2" fill="#ffffff" />

        {/* Soft rosy cheeks */}
        <ellipse cx="42" cy="65" rx="4.2" ry="2.4" fill={blush} opacity="0.65" />
        <ellipse cx="78" cy="65" rx="4.2" ry="2.4" fill={blush} opacity="0.65" />

        {/* Little serious "o / hmm" mouth */}
        <path
          d="M56 69c2.5-1.6 5.5-1.6 8 0"
          stroke="#6b3944"
          strokeWidth="2.2"
          strokeLinecap="round"
        />

        {/* Raised cute "Stop" hand */}
        <g transform="translate(86 64)">
          <circle cx="8" cy="10" r="9" fill="#ffe6d6" stroke={stickerBorder} strokeWidth="2" />
          <path
            d="M4 9V4.5M7.5 8.5V3.5M11 9V4.8"
            stroke="#d99a7e"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </g>
      </svg>
    </div>
  );
}

export function ModerationWarningModal({
  theme,
  warning,
  onEditContent,
  onClose,
  onSubmitAppeal,
}: ModerationWarningModalProps) {
  const [appealOpen, setAppealOpen] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [submittingAppeal, setSubmittingAppeal] = useState(false);
  const [appealSubmitted, setAppealSubmitted] = useState(false);
  const [appealError, setAppealError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        sfx.play('close');
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const escalation = getEscalationSummaryVi(
    warning.strikeNumber,
    warning.severity
  );

  const handleAppealSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!appealReason.trim() || appealReason.trim().length < 5) {
      setAppealError('Vui lòng giải thích ngắn gọn (tối thiểu 5 ký tự) để Admin xem xét.');
      return;
    }
    setSubmittingAppeal(true);
    setAppealError('');
    try {
      await onSubmitAppeal(warning.violationId, appealReason.trim());
      setAppealSubmitted(true);
      setAppealOpen(false);
      sfx.play('filterSelect');
    } catch (err) {
      setAppealError(
        err instanceof Error
          ? err.message
          : 'Không thể gửi yêu cầu xem xét lúc này.'
      );
    } finally {
      setSubmittingAppeal(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="moderation-warning-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim-base)] p-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="animate-warning-shake theme-panel relative max-h-[92vh] w-full max-w-lg overflow-y-auto border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 text-[var(--ink-primary)] shadow-2xl sm:p-7"
      >
        <button
          type="button"
          onClick={() => {
            sfx.play('close');
            onClose();
          }}
          aria-label="Đóng cảnh cáo"
          className="theme-control absolute top-4 right-4 flex h-8 w-8 items-center justify-center border border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
        >
          <X className="h-4 w-4" />
        </button>

        <CutePoliceOfficerSticker theme={theme} />

        <div className="mt-3 text-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-rose-500">
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>{escalation.title}</span>
          </div>
          <h2
            id="moderation-warning-title"
            className="font-editorial mt-1.5 text-balance text-2xl font-semibold text-[var(--ink-primary)] sm:text-3xl"
          >
            Ê ê, dừng lại một chút nhé!
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-[var(--ink-secondary)]">
            Nội dung bạn vừa gửi có thể không phù hợp với nội quy diễn đàn. Hãy
            chỉnh sửa lại và giao tiếp tôn trọng mọi người nhé.
          </p>
        </div>

        {/* Reason & Flagged Excerpt */}
        <div className="theme-control mt-5 space-y-2.5 border border-[var(--border-hairline)] bg-[var(--bg-canvas)]/85 p-4 text-left text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div>
              <p className="font-semibold text-[var(--ink-primary)]">
                Lý do cảnh cáo
              </p>
              <p className="mt-0.5 leading-relaxed text-[var(--ink-secondary)]">
                {warning.reason}
              </p>
            </div>
          </div>

          {warning.matchedExcerpt && (
            <div className="border-t border-[var(--border-hairline)] pt-2.5">
              <p className="text-[11px] font-medium text-[var(--ink-muted)]">
                Đoạn cần xem lại:
              </p>
              <p className="mt-1 rounded bg-rose-500/10 px-2.5 py-1.5 font-medium text-rose-600 dark:text-rose-300">
                “{warning.matchedExcerpt}”
              </p>
            </div>
          )}

          <div className="border-t border-[var(--border-hairline)] pt-2.5 text-[var(--ink-secondary)]">
            <p className="leading-relaxed">{escalation.guidance}</p>
            {warning.alreadyRecordedForDraft && (
              <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
                (Số lần vi phạm không tăng thêm vì bạn đang chỉnh sửa lại cùng
                một bản nháp chưa gửi.)
              </p>
            )}
            {warning.restrictedUntil > Date.now() && (
              <p className="mt-1.5 font-semibold text-rose-500">
                Tạm hạn chế tương tác đến: {formatDeadlineVi(warning.restrictedUntil)}
              </p>
            )}
          </div>
        </div>

        {/* Primary Actions */}
        <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              sfx.play('filterSelect');
              onEditContent();
            }}
            className="theme-control inline-flex h-11 items-center justify-center gap-2 bg-[var(--accent-primary)] px-4 text-xs font-semibold tracking-wider whitespace-nowrap text-[var(--accent-ink)] uppercase hover:bg-[var(--accent-hover)]"
          >
            <Edit3 className="h-3.5 w-3.5" />
            <span>Chỉnh sửa nội dung</span>
          </button>

          <button
            type="button"
            onClick={() => {
              sfx.play('close');
              onClose();
            }}
            className="theme-control inline-flex h-11 items-center justify-center gap-2 border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-4 text-xs font-semibold tracking-wider whitespace-nowrap text-[var(--ink-primary)] uppercase hover:border-[var(--accent-primary)]"
          >
            <span>Đã hiểu</span>
          </button>
        </div>

        {/* Appeal / False-Positive Review Request */}
        <div className="mt-4 border-t border-[var(--border-hairline)] pt-3.5 text-center">
          {appealSubmitted ? (
            <p className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>
                Đã gửi yêu cầu xem xét đến Quản trị viên. Bạn sẽ nhận thông báo
                khi có kết quả.
              </span>
            </p>
          ) : !appealOpen ? (
            <button
              type="button"
              onClick={() => setAppealOpen(true)}
              className="text-xs font-medium text-[var(--ink-muted)] underline decoration-dotted underline-offset-4 transition-colors hover:text-[var(--accent-primary)]"
            >
              Hệ thống nhận diện nhầm? Gửi yêu cầu Quản trị viên xem xét
            </button>
          ) : (
            <form onSubmit={handleAppealSubmit} className="space-y-2.5 text-left">
              <label className="block text-xs font-medium text-[var(--ink-secondary)]">
                Giải thích ngữ cảnh để Quản trị viên xem xét lại:
              </label>
              <textarea
                rows={2}
                maxLength={1000}
                value={appealReason}
                onChange={(e) => setAppealReason(e.target.value)}
                placeholder="Ví dụ: Đây là trích dẫn lời thoại nhân vật trong cốt truyện, không nhằm công kích ai..."
                className="theme-control w-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-xs text-[var(--ink-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
              />
              {appealError && (
                <p className="text-xs text-rose-500">{appealError}</p>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAppealOpen(false)}
                  className="theme-control h-8 px-3 text-xs text-[var(--ink-muted)] hover:text-[var(--ink-primary)]"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submittingAppeal}
                  className="theme-control inline-flex h-8 items-center gap-1.5 bg-[var(--accent-primary)] px-3.5 text-xs font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] disabled:opacity-60"
                >
                  {submittingAppeal ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5" />
                  )}
                  <span>Gửi yêu cầu xem xét</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
