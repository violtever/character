import { useEffect } from 'react';
import { motion } from 'motion/react';
import { Heart, Lock, X } from 'lucide-react';
import type { ThemeMode } from '../types/archive';
import { sfx } from '../utils/sfxEngine';

interface LoginPromptModalProps {
  theme: ThemeMode;
  reason?: string;
  onOpenLogin: () => void;
  onOpenRegister: () => void;
  onClose: () => void;
}

export function LoginPromptModal({
  theme,
  reason,
  onOpenLogin,
  onOpenRegister,
  onClose,
}: LoginPromptModalProps) {
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="login-prompt-title"
      onClick={() => {
        sfx.play('close');
        onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim-base)] p-4 backdrop-blur-md"
    >
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.97 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="theme-surface theme-panel relative w-full max-w-md border border-[var(--border-strong)] bg-[var(--bg-surface)] p-7 text-center text-[var(--ink-primary)] shadow-2xl"
      >
        <button
          type="button"
          onClick={() => {
            sfx.play('close');
            onClose();
          }}
          aria-label="Đóng thông báo"
          className="theme-control absolute top-4 right-4 flex h-8 w-8 items-center justify-center border border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)]"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--accent-soft)] text-[var(--accent-primary)]">
          {theme === 'light' ? (
            <Heart className="h-5 w-5" />
          ) : (
            <Lock className="h-5 w-5" />
          )}
        </div>

        <h2
          id="login-prompt-title"
          className="font-editorial mt-4 text-balance text-2xl font-semibold text-[var(--ink-primary)] sm:text-3xl"
        >
          Bạn cần đăng nhập để sử dụng tính năng này!
        </h2>

        <p className="mt-2.5 text-sm leading-relaxed text-[var(--ink-secondary)]">
          {reason ||
            'Hãy đăng nhập hoặc tạo tài khoản để tiếp tục. Sau khi đăng nhập, bạn sẽ quay lại đúng trang đang xem.'}
        </p>

        <div className="mt-7 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              sfx.play('filterSelect');
              onOpenLogin();
            }}
            className="theme-control h-11 bg-[var(--accent-primary)] px-4 text-xs font-semibold tracking-wider whitespace-nowrap text-[var(--accent-ink)] uppercase hover:bg-[var(--accent-hover)]"
          >
            ĐĂNG NHẬP
          </button>
          <button
            type="button"
            onClick={() => {
              sfx.play('filterSelect');
              onOpenRegister();
            }}
            className="theme-control h-11 border border-[var(--border-strong)] bg-[var(--bg-canvas)] px-4 text-xs font-semibold tracking-wider whitespace-nowrap text-[var(--ink-primary)] uppercase hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
          >
            ĐĂNG KÝ
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            sfx.play('close');
            onClose();
          }}
          className="mt-4 text-xs text-[var(--ink-muted)] transition-colors hover:text-[var(--ink-primary)]"
        >
          Quay lại trang đang xem
        </button>
      </motion.div>
    </motion.div>
  );
}
