import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  LogIn,
  Moon,
  Shield,
  Sun,
  UserPlus,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ARCHIVE_META } from '../config/mediaConfig';
import type { ThemeMode, UserProfile } from '../types/archive';
import { sfx } from '../utils/sfxEngine';
import { BrandWordmark } from './BrandWordmark';
import { ParticleField } from './ParticleField';
import { FloatingDreamyStickers, ThemeDivider } from './ThemeDecorations';

interface WelcomeScreenProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  sfxEnabled: boolean;
  onToggleSfx: () => void;
  recordCount: number;
  currentUser: UserProfile | null;
  onEnter: () => void;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onEnterAdmin: () => void;
}

export function WelcomeScreen({
  theme,
  onToggleTheme,
  sfxEnabled,
  onToggleSfx,
  recordCount,
  currentUser,
  onEnter,
  onOpenLogin,
  onOpenRegister,
  onEnterAdmin,
}: WelcomeScreenProps) {
  const [entering, setEntering] = useState(false);
  const [clock, setClock] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const formattedDate = clock.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const formattedTime = clock.toLocaleTimeString('vi-VN', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const handleEnterClick = () => {
    if (entering) return;
    sfx.unlock();
    sfx.play('welcomeClick');
    setEntering(true);
    window.setTimeout(() => {
      onEnter();
    }, 580);
  };

  return (
    <motion.section
      key="welcome-screen"
      initial={{ opacity: 0 }}
      animate={{
        opacity: entering ? 0 : 1,
        scale: entering ? 1.04 : 1,
      }}
      exit={{ opacity: 0, scale: 1.035 }}
      transition={{ duration: 0.62, ease: [0.22, 1, 0.36, 1] }}
      className="theme-surface archive-backdrop-light relative flex min-h-screen w-full flex-col justify-between overflow-hidden bg-[var(--bg-canvas)] text-[var(--ink-primary)]"
    >
      {/* Theme-aware dreamy clouds/blossoms (Light) or gothic corner filigree (Dark) */}
      <FloatingDreamyStickers theme={theme} />

      {/* Ambient shifting radial glow */}
      <div
        aria-hidden="true"
        className="animate-ambient-breath pointer-events-none absolute -top-28 left-1/2 h-[36rem] w-[52rem] -translate-x-1/2 rounded-full blur-3xl"
        style={{
          background:
            theme === 'dark'
              ? 'radial-gradient(ellipse at center, rgba(168, 36, 62, 0.28) 0%, rgba(74, 14, 26, 0.12) 48%, transparent 72%)'
              : 'radial-gradient(ellipse at center, rgba(180, 212, 255, 0.52) 0%, rgba(236, 206, 245, 0.32) 48%, transparent 74%)',
        }}
      />

      {/* Floating ambient dust & star particles */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <ParticleField theme={theme} density={52} />
      </div>

      {/* Architectural / Dreamy outer frame */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-4 z-10 border sm:inset-7 ${
          theme === 'light'
            ? 'rounded-[1.75rem] border-dashed border-[var(--border-strong)]/60'
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

      {/* Top Bar */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-20 flex items-center justify-between gap-4 px-8 pt-8 sm:px-14 sm:pt-12"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ink-muted)]">
          <span className="font-mono-archive">{ARCHIVE_META.collectionLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-archive">{ARCHIVE_META.established}</span>
          <span aria-hidden="true" className="hidden sm:inline">
            ·
          </span>
          <span className="font-mono-archive hidden sm:inline">
            {recordCount} hồ sơ nhân vật
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleSfx}
            onMouseEnter={() => sfx.play('hover')}
            aria-label={sfxEnabled ? 'Tắt hiệu ứng âm thanh' : 'Bật hiệu ứng âm thanh'}
            className="theme-control flex h-10 w-10 items-center justify-center border border-[var(--border-hairline)] bg-[var(--bg-surface)]/85 text-[var(--ink-secondary)] backdrop-blur-sm hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
          >
            {sfxEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={onToggleTheme}
            onMouseEnter={() => sfx.play('hover')}
            aria-label={
              theme === 'dark'
                ? 'Chuyển sang giao diện Sáng ngọt ngào'
                : 'Chuyển sang giao diện Tối rượu vang bí ẩn'
            }
            className="theme-control flex h-10 items-center gap-2 border border-[var(--border-hairline)] bg-[var(--bg-surface)]/85 px-3.5 text-xs font-medium whitespace-nowrap text-[var(--ink-secondary)] backdrop-blur-sm hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-3.5 w-3.5 text-[var(--accent-secondary)]" />
                <span className="hidden sm:inline">Sáng · Dreamy</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                <span className="hidden sm:inline">Tối · Wine Archive</span>
              </>
            )}
          </button>
        </div>
      </motion.header>

      {/* Center Cinematic Portal */}
      <main className="relative z-20 mx-auto flex max-w-3xl flex-col items-center px-8 py-10 text-center">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.16 }}
          className="font-mono-archive text-[11px] tracking-[0.26em] text-[var(--ink-muted)] uppercase"
        >
          {ARCHIVE_META.subtitleEn}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.9, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 text-balance"
        >
          <BrandWordmark theme={theme} size="lg" centered />
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, scaleX: 0.8 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.7, delay: 0.42 }}
          className="mt-6 w-56 sm:w-72"
        >
          <ThemeDivider theme={theme} />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 12, filter: 'blur(5px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 0.48, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 max-w-xl text-base leading-relaxed text-[var(--ink-secondary)] sm:text-lg"
        >
          {ARCHIVE_META.tagline}
        </motion.p>

        {/* Signed-in welcome indicator if already authenticated */}
        {currentUser && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 text-xs text-[var(--ink-muted)]"
          >
            Đang đăng nhập với tên{' '}
            <strong className="text-[var(--ink-primary)]">
              {currentUser.displayName}
            </strong>{' '}
            ·{' '}
            <span>
              {currentUser.role === 'admin' ? 'Quản trị viên' : 'Thành viên'}
            </span>
          </motion.p>
        )}

        {/* Primary & Auth Actions (Public Archive first — no forced login!) */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.78, delay: 0.62, ease: [0.22, 1, 0.36, 1] }}
          className="mt-9 flex flex-wrap items-center justify-center gap-3"
        >
          <button
            type="button"
            onClick={handleEnterClick}
            onMouseEnter={() => sfx.play('hover')}
            className="theme-control group relative inline-flex h-12 items-center gap-2.5 overflow-hidden border border-[var(--accent-primary)] bg-[var(--accent-primary)] px-7 text-xs font-semibold tracking-[0.14em] whitespace-nowrap text-[var(--accent-ink)] uppercase hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] hover:shadow-[0_14px_34px_-10px_var(--glow-ambient)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent-primary)]"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
            />
            <span className="relative">TRUY CẬP THƯ VIỆN</span>
            <ArrowRight className="relative h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </button>

          {!currentUser ? (
            <>
              <button
                type="button"
                onClick={() => {
                  sfx.unlock();
                  sfx.play('filterSelect');
                  onOpenLogin();
                }}
                onMouseEnter={() => sfx.play('hover')}
                className="theme-control inline-flex h-12 items-center gap-2 border border-[var(--border-strong)] bg-[var(--bg-surface)]/85 px-5 text-xs font-semibold tracking-[0.12em] whitespace-nowrap text-[var(--ink-primary)] uppercase backdrop-blur-sm hover:-translate-y-0.5 hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>ĐĂNG NHẬP</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  sfx.unlock();
                  sfx.play('filterSelect');
                  onOpenRegister();
                }}
                onMouseEnter={() => sfx.play('hover')}
                className="theme-control inline-flex h-12 items-center gap-2 border border-[var(--border-hairline)] bg-[var(--bg-surface)]/70 px-5 text-xs font-semibold tracking-[0.12em] whitespace-nowrap text-[var(--ink-secondary)] uppercase backdrop-blur-sm hover:-translate-y-0.5 hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
              >
                <UserPlus className="h-3.5 w-3.5" />
                <span>ĐĂNG KÝ</span>
              </button>
            </>
          ) : (
            currentUser.role === 'admin' && (
              <button
                type="button"
                onClick={() => {
                  sfx.unlock();
                  sfx.play('openCharacter');
                  onEnterAdmin();
                }}
                onMouseEnter={() => sfx.play('hover')}
                className="theme-control inline-flex h-12 items-center gap-2 border border-[var(--border-strong)] bg-[var(--bg-surface)]/88 px-5 text-xs font-semibold tracking-[0.12em] whitespace-nowrap text-[var(--accent-primary)] uppercase backdrop-blur-sm hover:-translate-y-0.5 hover:border-[var(--accent-primary)]"
              >
                <Shield className="h-3.5 w-3.5" />
                <span>TRUNG TÂM QUẢN TRỊ</span>
              </button>
            )
          )}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.82 }}
          className="mt-6 text-xs text-[var(--ink-muted)]"
        >
          Thư viện mở công khai cho mọi khách ghé thăm · Không bắt buộc đăng nhập để xem hồ sơ
        </motion.p>
      </main>

      {/* Bottom Colophon */}
      <motion.footer
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.65, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-20 flex flex-wrap items-center justify-between gap-4 px-8 pb-8 text-xs text-[var(--ink-muted)] sm:px-14 sm:pb-11"
      >
        <div className="font-mono-archive flex items-center gap-3">
          <span>{formattedDate}</span>
          <span aria-hidden="true">·</span>
          <span>{formattedTime}</span>
        </div>
        <span>
          {theme === 'dark'
            ? 'Phiên bản: Wine Archive · Huyền bí'
            : 'Phiên bản: Pastel Sky · Mộng mơ'}
        </span>
      </motion.footer>
    </motion.section>
  );
}
