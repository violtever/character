import type { ThemeMode } from '../types/archive';

interface ThemeDividerProps {
  theme: ThemeMode;
  className?: string;
}

export function ThemeDivider({ theme, className = '' }: ThemeDividerProps) {
  const isLight = theme === 'light';

  return (
    <div
      aria-hidden="true"
      className={`flex items-center justify-center gap-4 ${className}`}
    >
      <span
        className={`h-px flex-1 ${
          isLight
            ? 'border-t border-dashed border-[var(--border-strong)]/60'
            : 'bg-gradient-to-r from-transparent via-[var(--border-strong)] to-[var(--accent-primary)]/60'
        }`}
      />
      {isLight ? (
        /* Cute dreamy bow + star motif */
        <div className="flex items-center gap-2 text-[var(--accent-secondary)]">
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
            <path d="M8 1L9.6 6.4L15 8L9.6 9.6L8 15L6.4 9.6L1 8L6.4 6.4L8 1Z" />
          </svg>
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5 text-[var(--accent-primary)]"
            fill="none"
          >
            <path
              d="M12 12C9.2 8.2 4.6 7 3.8 9.8C3 12.2 6.8 14.2 12 12Z"
              fill="currentColor"
              fillOpacity="0.18"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M12 12C14.8 8.2 19.4 7 20.2 9.8C21 12.2 17.2 14.2 12 12Z"
              fill="currentColor"
              fillOpacity="0.18"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <path
              d="M11 13L8.5 19.5M13 13L15.5 19.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <circle cx="12" cy="12" r="2" fill="var(--accent-secondary)" />
          </svg>
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
            <path d="M8 1L9.6 6.4L15 8L9.6 9.6L8 15L6.4 9.6L1 8L6.4 6.4L8 1Z" />
          </svg>
        </div>
      ) : (
        /* Gothic crimson rose & symmetrical filigree emblem */
        <div className="flex items-center gap-2.5 text-[var(--accent-primary)]">
          <span className="h-1.5 w-1.5 rotate-45 bg-[var(--accent-secondary)]/70" />
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <path
              d="M12 4C9.5 4 7.5 6 7.5 8.5C7.5 11 9.5 13 12 13C14.5 13 16.5 11 16.5 8.5C16.5 6 14.5 4 12 4Z"
              fill="currentColor"
              fillOpacity="0.28"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <path
              d="M12 6.5C10.8 6.5 10 7.4 10 8.5C10 9.6 10.8 10.5 12 10.5C13.2 10.5 14 9.6 14 8.5"
              stroke="var(--ink-primary)"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
            <path
              d="M12 13V20M12 16.5C9.8 16.5 8.5 15.2 8 14M12 17.5C14.2 17.5 15.5 16.2 16 15"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          <span className="h-1.5 w-1.5 rotate-45 bg-[var(--accent-secondary)]/70" />
        </div>
      )}
      <span
        className={`h-px flex-1 ${
          isLight
            ? 'border-t border-dashed border-[var(--border-strong)]/60'
            : 'bg-gradient-to-l from-transparent via-[var(--border-strong)] to-[var(--accent-primary)]/60'
        }`}
      />
    </div>
  );
}

interface FloatingDreamyStickersProps {
  theme: ThemeMode;
}

export function FloatingDreamyStickers({ theme }: FloatingDreamyStickersProps) {
  if (theme === 'dark') {
    return (
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Subtle gothic symmetrical top-left & bottom-right crimson rose water-line ornaments */}
        <svg
          viewBox="0 0 120 120"
          className="absolute top-16 left-8 hidden h-20 w-20 text-[var(--accent-primary)] opacity-20 lg:block"
          fill="none"
        >
          <path d="M8 60V8H60" stroke="currentColor" strokeWidth="1" />
          <path d="M16 52V16H52" stroke="currentColor" strokeWidth="0.8" />
          <path
            d="M32 32L36 24L40 32L48 36L40 40L36 48L32 40L24 36L32 32Z"
            fill="currentColor"
            fillOpacity="0.4"
          />
        </svg>
        <svg
          viewBox="0 0 120 120"
          className="absolute right-8 bottom-20 hidden h-20 w-20 rotate-180 text-[var(--accent-primary)] opacity-20 lg:block"
          fill="none"
        >
          <path d="M8 60V8H60" stroke="currentColor" strokeWidth="1" />
          <path d="M16 52V16H52" stroke="currentColor" strokeWidth="0.8" />
          <path
            d="M32 32L36 24L40 32L48 36L40 40L36 48L32 40L24 36L32 32Z"
            fill="currentColor"
            fillOpacity="0.4"
          />
        </svg>
      </div>
    );
  }

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Light mode floating dreamy cloud & pastel blossom stickers */}
      <svg
        viewBox="0 0 96 56"
        className="animate-dreamy-float absolute top-20 left-[6%] hidden h-12 w-20 text-white/80 drop-shadow-sm lg:block"
        fill="currentColor"
      >
        <path d="M24 46H72C82 46 88 39.5 88 31.5C88 24 82.4 18 75 17.2C72.2 8.4 63.8 2 53.8 2C42.2 2 32.6 10.6 31.3 21.8C29.4 21.2 27.3 20.8 25.1 20.8C15.6 20.8 8 27.8 8 36.2C8 41.8 14.5 46 24 46Z" />
      </svg>

      <svg
        viewBox="0 0 40 40"
        style={{ animationDelay: '-2.2s' }}
        className="animate-dreamy-float absolute top-28 right-[9%] hidden h-9 w-9 text-[var(--accent-secondary)] opacity-65 lg:block"
        fill="currentColor"
      >
        {/* 5-petal dreamy pastel flower */}
        <circle cx="20" cy="11" r="6" fillOpacity="0.65" />
        <circle cx="28.5" cy="17.2" r="6" fillOpacity="0.65" />
        <circle cx="25.2" cy="27.2" r="6" fillOpacity="0.65" />
        <circle cx="14.8" cy="27.2" r="6" fillOpacity="0.65" />
        <circle cx="11.5" cy="17.2" r="6" fillOpacity="0.65" />
        <circle cx="20" cy="20" r="4" fill="#ffffff" />
      </svg>

      <svg
        viewBox="0 0 32 32"
        style={{ animationDelay: '-4.1s' }}
        className="animate-dreamy-float absolute bottom-24 left-[10%] hidden h-7 w-7 text-[var(--accent-lavender)] opacity-75 lg:block"
        fill="currentColor"
      >
        <path d="M16 2L19.4 12.6L30 16L19.4 19.4L16 30L12.6 19.4L2 16L12.6 12.6L16 2Z" />
      </svg>
    </div>
  );
}
