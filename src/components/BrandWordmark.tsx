import type { ThemeMode } from '../types/archive';

interface BrandWordmarkProps {
  theme: ThemeMode;
  size?: 'sm' | 'md' | 'lg';
  showArchiveSuffix?: boolean;
  centered?: boolean;
}

export function BrandWordmark({
  theme,
  size = 'md',
  showArchiveSuffix = true,
  centered = false,
}: BrandWordmarkProps) {
  const isLight = theme === 'light';

  const handleSize =
    size === 'lg'
      ? 'text-4xl sm:text-6xl'
      : size === 'sm'
        ? 'text-xl sm:text-2xl'
        : 'text-2xl sm:text-[1.7rem]';

  const suffixSize =
    size === 'lg'
      ? 'text-2xl sm:text-4xl'
      : size === 'sm'
        ? 'text-base sm:text-lg'
        : 'text-lg sm:text-xl';

  return (
    <span
      className={`inline-flex flex-wrap items-baseline gap-x-1.5 leading-none select-none ${
        centered ? 'justify-center' : ''
      }`}
    >
      {/* Signature decorative mark morphing between Cute Dreamy Light & Gothic Wine Dark */}
      {isLight ? (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`shrink-0 self-center text-[var(--accent-secondary)] ${
            size === 'lg'
              ? 'mr-1.5 h-7 w-7 sm:h-9 sm:w-9'
              : 'mr-0.5 h-4 w-4 sm:h-5 sm:w-5'
          }`}
          fill="none"
        >
          {/* Delicate ribbon bow */}
          <path
            d="M12 12C9.5 8.5 5 7 4 9.8C3.2 12 6.8 14 12 12Z"
            fill="currentColor"
            fillOpacity="0.28"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M12 12C14.5 8.5 19 7 20 9.8C20.8 12 17.2 14 12 12Z"
            fill="currentColor"
            fillOpacity="0.28"
            stroke="currentColor"
            strokeWidth="1.4"
          />
          <path
            d="M11.2 13L8.2 19M12.8 13L15.8 19"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="12" cy="12" r="2" fill="var(--accent-primary)" />
        </svg>
      ) : (
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className={`shrink-0 self-center text-[var(--accent-primary)] ${
            size === 'lg'
              ? 'mr-1.5 h-7 w-7 sm:h-9 sm:w-9'
              : 'mr-0.5 h-4 w-4 sm:h-5 sm:w-5'
          }`}
          fill="none"
        >
          {/* Gothic crimson rose-diamond emblem */}
          <path
            d="M12 2.5L14.8 9.2L21.5 12L14.8 14.8L12 21.5L9.2 14.8L2.5 12L9.2 9.2L12 2.5Z"
            fill="currentColor"
            fillOpacity="0.24"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <circle cx="12" cy="12" r="2.2" fill="var(--ink-primary)" />
        </svg>
      )}

      <span
        className={`font-brand-signature font-semibold tracking-tight ${handleSize}`}
      >
        <span className="italic text-[var(--accent-primary)]">xo</span>
        <span className="text-[var(--ink-primary)]">cyberluv</span>
      </span>

      {showArchiveSuffix && (
        <span
          className={`font-editorial font-normal tracking-tight text-[var(--ink-secondary)] ${suffixSize}`}
        >
          ’s character archive
        </span>
      )}
    </span>
  );
}
