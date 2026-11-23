import { useEffect, useState, type MouseEvent } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Moon,
  Shield,
  Sun,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { ARCHIVE_META } from '../config/mediaConfig';
import type { ThemeMode, UserProfile } from '../types/archive';
import { musicPlayer } from '../utils/musicEngine';
import { sfx } from '../utils/sfxEngine';
import { BrandWordmark } from './BrandWordmark';
import { ParticleField } from './ParticleField';
import { FloatingDreamyStickers, ThemeDivider } from './ThemeDecorations';

interface WelcomeScreenProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  sfxEnabled: boolean;
  onToggleSfx: () => void;
  recordCount: number | null;
  authReady: boolean;
  currentUser: UserProfile | null;
  onEnter: () => void;
}

export function WelcomeScreen({
  theme,
  onToggleTheme,
  sfxEnabled,
  onToggleSfx,
  recordCount,
  authReady,
  currentUser,
  onEnter,
}: WelcomeScreenProps) {
  const [clock, setClock] = useState(() => new Date());
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [allowParallax, setAllowParallax] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setClock(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    setAllowParallax(!reduced && !coarse);
  }, []);

  const handleMouseMove = (e: MouseEvent<HTMLElement>) => {
    if (!allowParallax) return;
    const nx = (e.clientX / window.innerWidth - 0.5) * 2;
    const ny = (e.clientY / window.innerHeight - 0.5) * 2;
    setParallax({ x: nx * 12, y: ny * 10 });
  };

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
    // Preserve browser user-gesture activation synchronously so background music
    // begins immediately upon transitioning into the Loading Screen.
    sfx.unlock();
    sfx.play('welcomeClick');
    musicPlayer.startAutoplayFromGesture();
    onEnter();
  };

  const userInitial = (currentUser?.displayName || 'U').charAt(0).toUpperCase();

  return (
    <motion.section
      key="welcome-screen"
      onMouseMove={handleMouseMove}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className="theme-surface archive-backdrop-light relative flex min-h-screen w-full flex-col justify-between overflow-hidden bg-[var(--bg-canvas)] text-[var(--ink-primary)]"
    >
      {/* Theme-aware dreamy clouds/blossoms (Light) or gothic corner filigree (Dark) */}
      <FloatingDreamyStickers theme={theme} />

      {/* Layered ambient shifting radial glow with subtle pointer parallax */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 left-1/2 h-[38rem] w-[54rem] -translate-x-1/2 transition-transform duration-700 ease-out"
        style={{
          transform: `translate3d(${parallax.x}px, ${parallax.y}px, 0)`,
        }}
      >
        <div
          className="animate-ambient-breath h-full w-full rounded-full blur-3xl"
          style={{
            background:
              theme === 'dark'
                ? 'radial-gradient(ellipse at center, rgba(168, 36, 62, 0.32) 0%, rgba(74, 14, 26, 0.14) 48%, transparent 72%)'
                : 'radial-gradient(ellipse at center, rgba(176, 210, 255, 0.56) 0%, rgba(236, 206, 245, 0.34) 48%, transparent 74%)',
          }}
        />
      </div>

      {/* Floating ambient dust, bokeh & star particles */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <ParticleField theme={theme} density={56} />
      </div>

      {/* Architectural / Dreamy outer frame */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-4 z-10 border transition-transform duration-700 ease-out sm:inset-7 ${
          theme === 'light'
            ? 'rounded-[1.75rem] border-dashed border-[var(--border-strong)]/60'
            : 'border-[var(--border-hairline)]'
        }`}
        style={{
          transform: allowParallax
            ? `translate3d(${-parallax.x * 0.25}px, ${-parallax.y * 0.25}px, 0)`
            : undefined,
        }}
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
        transition={{ duration: 0.6, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-20 flex items-center justify-between gap-4 px-8 pt-8 sm:px-14 sm:pt-12"
      >
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--ink-muted)]">
          <span className="font-mono-archive">{ARCHIVE_META.collectionLabel}</span>
          <span aria-hidden="true">·</span>
          <span className="font-mono-archive">{ARCHIVE_META.established}</span>
          {recordCount !== null && (
            <>
              <span aria-hidden="true" className="hidden sm:inline">
                ·
              </span>
              <span className="font-mono-archive hidden sm:inline">
                {recordCount} hồ sơ nhân vật
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleSfx}
            onMouseEnter={() => sfx.play('hover')}
            aria-label={sfxEnabled ? 'Tắt hiệu ứng âm thanh' : 'Bật hiệu ứng âm thanh'}
            className="theme-control btn-tactile flex h-10 w-10 items-center justify-center border border-[var(--border-hairline)] bg-[var(--bg-surface)]/85 text-[var(--ink-secondary)] backdrop-blur-sm hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
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
            className="theme-control btn-tactile flex h-10 items-center gap-2 border border-[var(--border-hairline)] bg-[var(--bg-surface)]/85 px-3.5 text-xs font-medium whitespace-nowrap text-[var(--ink-secondary)] backdrop-blur-sm hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
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
          transition={{ duration: 0.65, delay: 0.14 }}
          className="font-mono-archive text-[11px] tracking-[0.26em] text-[var(--ink-muted)] uppercase"
        >
          {ARCHIVE_META.subtitleEn}
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.85, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 text-balance"
        >
          <BrandWordmark theme={theme} size="lg" centered />
        </motion.h1>

        <motion.div
          initial={{ opacity: 0, scaleX: 0.8 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.65, delay: 0.36 }}
          className="mt-6 w-56 sm:w-72"
        >
          <ThemeDivider theme={theme} />
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 12, filter: 'blur(5px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.75, delay: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 max-w-xl text-base leading-relaxed text-[var(--ink-secondary)] sm:text-lg"
        >
          {ARCHIVE_META.tagline}
        </motion.p>

        {/* Real synced session indicator if user is already signed in */}
        {authReady && currentUser && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 inline-flex items-center gap-2.5 text-xs text-[var(--ink-secondary)]"
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-strong)] bg-[var(--accent-soft)] text-[11px] font-semibold text-[var(--accent-primary)]">
              {currentUser.photoURL ? (
                <img
                  src={currentUser.photoURL}
                  alt={currentUser.displayName}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                userInitial
              )}
            </span>
            <span>
              Xin chào,{' '}
              <strong className="text-[var(--ink-primary)]">
                {currentUser.displayName}
              </strong>
            </span>
            {currentUser.role === 'admin' && currentUser.emailVerified && (
              <span className="inline-flex items-center gap-1 font-mono-archive text-[10px] font-semibold tracking-wider text-[var(--accent-primary)] uppercase">
                <Shield className="h-3 w-3" />
                ADMIN
              </span>
            )}
          </motion.div>
        )}

        {/* Single primary entrance action — transitions directly into real Loading Screen */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.72, delay: 0.54, ease: [0.22, 1, 0.36, 1] }}
          className="relative mt-9 flex items-center justify-center"
        >
          {/* Soft ambient halo behind primary entrance CTA */}
          <span
            aria-hidden="true"
            className="animate-soft-beacon pointer-events-none absolute -inset-2 rounded-2xl blur-xl"
            style={{
              background:
                theme === 'dark'
                  ? 'radial-gradient(circle, rgba(181, 43, 68, 0.36) 0%, transparent 72%)'
                  : 'radial-gradient(circle, rgba(37, 88, 212, 0.25) 0%, rgba(226, 128, 167, 0.22) 55%, transparent 75%)',
            }}
          />
          <button
            type="button"
            onClick={handleEnterClick}
            onMouseEnter={() => sfx.play('hover')}
            className="theme-control btn-tactile group relative inline-flex h-12 items-center gap-2.5 overflow-hidden border border-[var(--accent-primary)] bg-[var(--accent-primary)] px-8 text-xs font-semibold tracking-[0.14em] whitespace-nowrap text-[var(--accent-ink)] uppercase shadow-[0_12px_30px_-10px_var(--glow-ambient)] hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] hover:shadow-[0_16px_38px_-8px_var(--glow-ambient)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--accent-primary)]"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full"
            />
            <span className="relative">TRUY CẬP THƯ VIỆN</span>
            <ArrowRight className="relative h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.75, delay: 0.72 }}
          className="mt-6 text-xs text-[var(--ink-muted)]"
        >
          Thư viện mở công khai cho mọi khách ghé thăm · Không bắt buộc đăng nhập để xem hồ sơ
        </motion.p>
      </main>

      {/* Bottom Colophon */}
      <motion.footer
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.44, ease: [0.22, 1, 0.36, 1] }}
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
