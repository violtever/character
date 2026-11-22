import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  CheckCheck,
  Heart,
  Info,
  Megaphone,
  MessageSquare,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import type {
  NotificationType,
  ThemeMode,
  UserNotification,
} from '../types/archive';
import { formatRelativeVietnameseTime } from './ForumPostDetailModal';
import { sfx } from '../utils/sfxEngine';

type NotificationFilterTab = 'all' | NotificationType;

interface NotificationCenterProps {
  theme: ThemeMode;
  notifications: UserNotification[];
  onSelectNotification: (notification: UserNotification) => void;
  onMarkRead: (notificationId: string, isRead: boolean) => void;
  onMarkAllRead: () => void;
  onDeleteNotification: (notificationId: string) => void;
}

const FILTER_TABS: Array<{ id: NotificationFilterTab; label: string }> = [
  { id: 'all', label: 'Tất cả' },
  { id: 'important_post', label: 'Quan trọng' },
  { id: 'interaction', label: 'Tương tác' },
  { id: 'warning', label: 'Cảnh cáo' },
  { id: 'system', label: 'Hệ thống' },
];

function NotificationIcon({
  type,
  subtype,
}: {
  type: NotificationType;
  subtype: string;
}) {
  if (type === 'important_post') {
    return <Megaphone className="h-4 w-4 text-[var(--accent-primary)]" />;
  }
  if (type === 'warning') {
    return <ShieldAlert className="h-4 w-4 text-rose-500" />;
  }
  if (type === 'interaction') {
    if (subtype === 'like') {
      return <Heart className="h-4 w-4 text-pink-500" />;
    }
    return <MessageSquare className="h-4 w-4 text-sky-500" />;
  }
  return <Info className="h-4 w-4 text-amber-500" />;
}

function typeLabelVi(type: NotificationType): string {
  if (type === 'important_post') return 'Bài đăng quan trọng';
  if (type === 'interaction') return 'Tương tác';
  if (type === 'warning') return 'Cảnh cáo';
  return 'Hệ thống';
}

export function NotificationCenter({
  theme,
  notifications,
  onSelectNotification,
  onMarkRead,
  onMarkAllRead,
  onDeleteNotification,
}: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationFilterTab>('all');
  const containerRef = useRef<HTMLDivElement | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  const filtered = useMemo(() => {
    if (activeTab === 'all') return notifications;
    return notifications.filter((n) => n.type === activeTab);
  }, [notifications, activeTab]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          sfx.play('filterSelect');
          setOpen((prev) => !prev);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Thông báo${unreadCount > 0 ? ` (${unreadCount} chưa đọc)` : ''}`}
        className={`theme-control relative inline-flex h-9 shrink-0 items-center gap-1.5 border px-2.5 text-xs font-medium whitespace-nowrap ${
          open
            ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)] text-[var(--accent-primary)]'
            : 'border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]'
        }`}
      >
        <Bell className="h-3.5 w-3.5" />
        <span className="hidden lg:inline">Thông báo</span>
        {unreadCount > 0 && (
          <span className="font-mono-archive inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            role="dialog"
            aria-label="Trung tâm thông báo"
            className={`theme-panel absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-md overflow-hidden border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-2xl sm:w-[400px] ${
              theme === 'light'
                ? 'shadow-[0_24px_56px_-18px_rgba(37,88,212,0.28)]'
                : 'shadow-[0_24px_56px_-18px_rgba(0,0,0,0.9)]'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-2 border-b border-[var(--border-hairline)] px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--ink-primary)]">
                  Trung tâm thông báo
                </h3>
                <p className="font-mono-archive text-[11px] text-[var(--ink-muted)]">
                  {unreadCount > 0
                    ? `${unreadCount} thông báo chưa đọc`
                    : 'Bạn đã đọc hết thông báo'}
                </p>
              </div>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('filterSelect');
                    onMarkAllRead();
                  }}
                  className="theme-control inline-flex h-8 items-center gap-1 border border-[var(--border-hairline)] px-2.5 text-[11px] font-medium whitespace-nowrap text-[var(--accent-primary)] hover:border-[var(--accent-primary)]"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Đọc tất cả</span>
                </button>
              )}
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)]/60 px-3 py-2">
              {FILTER_TABS.map((tab) => {
                const count =
                  tab.id === 'all'
                    ? unreadCount
                    : notifications.filter(
                        (n) => n.type === tab.id && !n.isRead
                      ).length;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      sfx.play('filterSelect');
                      setActiveTab(tab.id);
                    }}
                    className={`theme-control shrink-0 px-2.5 py-1 text-[11px] font-medium whitespace-nowrap ${
                      active
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-ink)]'
                        : 'text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]'
                    }`}
                  >
                    {tab.label}
                    {count > 0 ? ` (${count})` : ''}
                  </button>
                );
              })}
            </div>

            {/* Notification List */}
            <div className="archive-scroll max-h-[60vh] divide-y divide-[var(--border-hairline)] overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Bell className="mx-auto h-7 w-7 text-[var(--ink-muted)]/60" />
                  <p className="mt-2.5 text-xs font-medium text-[var(--ink-secondary)]">
                    Chưa có thông báo nào trong mục này.
                  </p>
                </div>
              ) : (
                filtered.map((item) => (
                  <div
                    key={item.id}
                    className={`group flex items-start gap-3 px-4 py-3 transition-colors ${
                      item.isRead
                        ? 'bg-transparent hover:bg-[var(--bg-canvas)]/70'
                        : 'bg-[var(--accent-soft)]/45 hover:bg-[var(--accent-soft)]/70'
                    }`}
                  >
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
                      <NotificationIcon
                        type={item.type}
                        subtype={item.subtype}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        sfx.play('openCharacter');
                        if (!item.isRead) onMarkRead(item.id, true);
                        setOpen(false);
                        onSelectNotification(item);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-1.5 text-[10px] font-medium text-[var(--ink-muted)]">
                        <span>{typeLabelVi(item.type)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-archive">
                          {formatRelativeVietnameseTime(item.createdAt)}
                        </span>
                        {!item.isRead && (
                          <span className="ml-1 font-semibold text-[var(--accent-primary)]">
                            Mới
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs leading-snug font-semibold text-[var(--ink-primary)]">
                        {item.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[var(--ink-secondary)]">
                        {item.body}
                      </p>
                    </button>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <button
                        type="button"
                        onClick={() => onMarkRead(item.id, !item.isRead)}
                        title={
                          item.isRead ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'
                        }
                        className="theme-control px-1.5 py-0.5 text-[10px] text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
                      >
                        {item.isRead ? 'Chưa đọc' : 'Đã đọc'}
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteNotification(item.id)}
                        aria-label="Xóa thông báo"
                        className="theme-control flex h-6 w-6 items-center justify-center text-[var(--ink-muted)] opacity-70 hover:bg-rose-500/10 hover:text-rose-500 hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
