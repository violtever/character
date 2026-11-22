import { motion } from 'motion/react';
import { ArrowRight, Megaphone, X } from 'lucide-react';
import type { ImportantAnnouncement, ThemeMode } from '../types/archive';
import { formatRelativeVietnameseTime } from './ForumPostDetailModal';
import { sfx } from '../utils/sfxEngine';

interface ImportantAnnouncementPopupProps {
  theme: ThemeMode;
  announcement: ImportantAnnouncement;
  onOpenPost: (postId: string) => void;
  onDismiss: (announcementId: string) => void;
}

export function ImportantAnnouncementPopup({
  theme,
  announcement,
  onOpenPost,
  onDismiss,
}: ImportantAnnouncementPopupProps) {
  return (
    <motion.aside
      initial={{ opacity: 0, x: -24, y: 12 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, x: -20, y: 10 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      role="status"
      aria-live="polite"
      className={`theme-card fixed bottom-20 left-4 z-40 w-[calc(100vw-2rem)] max-w-sm overflow-hidden border p-4 shadow-2xl backdrop-blur-md sm:bottom-6 sm:left-6 ${
        theme === 'light'
          ? 'border-[#2558d4]/40 bg-[#f6f9ff]/95 text-[var(--ink-primary)] shadow-[0_20px_44px_-16px_rgba(37,88,212,0.34)]'
          : 'border-[#b52b44]/55 bg-[#1b0b11]/95 text-[var(--ink-primary)] shadow-[0_20px_48px_-14px_rgba(0,0,0,0.9)]'
      }`}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-[var(--accent-primary)] uppercase">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)]">
            <Megaphone className="h-3.5 w-3.5" />
          </span>
          <span>Thông báo quan trọng · Admin</span>
        </div>

        <button
          type="button"
          onClick={() => {
            sfx.play('close');
            onDismiss(announcement.id);
          }}
          aria-label="Đóng popup thông báo (vẫn lưu trong Trung tâm thông báo)"
          className="theme-control flex h-7 w-7 shrink-0 items-center justify-center text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => {
          sfx.play('openCharacter');
          onOpenPost(announcement.postId);
        }}
        className="mt-2.5 block w-full text-left group"
      >
        <h3 className="font-editorial line-clamp-2 text-lg leading-snug font-semibold text-[var(--ink-primary)] transition-colors group-hover:text-[var(--accent-primary)]">
          {announcement.title}
        </h3>
        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--ink-secondary)]">
          {announcement.excerpt}
        </p>
        <div className="mt-3 flex items-center justify-between border-t border-[var(--border-hairline)] pt-2.5 text-[11px] text-[var(--ink-muted)]">
          <span className="font-mono-archive">
            {announcement.authorName} ·{' '}
            {formatRelativeVietnameseTime(announcement.updatedAt)}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold text-[var(--accent-primary)] transition-transform group-hover:translate-x-0.5">
            <span>Xem bài viết</span>
            <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </button>
    </motion.aside>
  );
}
