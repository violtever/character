import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Feather, Heart, Sparkles } from 'lucide-react';
import type { CharacterRecord, ThemeMode } from '../types/archive';
import { sfx } from '../utils/sfxEngine';

interface CharacterCardProps {
  character: CharacterRecord;
  index: number;
  theme: ThemeMode;
  isFavorited: boolean;
  onSelect: (character: CharacterRecord) => void;
  onToggleFavorite: (id: string) => void;
}

export function CharacterCard({
  character,
  index,
  theme,
  isFavorited,
  onSelect,
  onToggleFavorite,
}: CharacterCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const showFallback = !character.image || imgFailed;

  const displayTags = [character.genre, ...character.tags.slice(0, 2)].filter(
    (item, idx, arr) => item && arr.indexOf(item) === idx
  );

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{
        duration: 0.42,
        delay: Math.min(index * 0.04, 0.24),
        ease: [0.22, 1, 0.36, 1],
      }}
      onMouseEnter={() => sfx.play('hover')}
      className="theme-card group relative flex flex-col overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-surface)] hover:-translate-y-1.5 hover:border-[var(--accent-primary)]/60 hover:shadow-[var(--card-shadow)]"
    >
      {/* Theme-specific corner ornament */}
      {theme === 'light' ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-3 right-3 z-20 text-white/90 opacity-0 transition-all duration-300 group-hover:scale-110 group-hover:opacity-100"
        >
          <Sparkles className="h-4 w-4 drop-shadow" />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-2.5 right-2.5 z-20 h-3.5 w-3.5 border-t border-r border-[var(--accent-secondary)]/70 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        />
      )}

      {/* Portrait container */}
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-[var(--bg-elevated)]">
        <button
          type="button"
          onClick={() => onSelect(character)}
          aria-label={`Mở hồ sơ nhân vật ${character.name}`}
          className="block h-full w-full text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
        >
          {showFallback ? (
            <div className="flex h-full w-full flex-col items-center justify-center bg-[var(--bg-elevated)] px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border-strong)] text-[var(--accent-primary)]">
                <Feather className="h-5 w-5" />
              </div>
              <p className="font-editorial mt-4 text-2xl font-medium text-[var(--ink-primary)]">
                {character.name}
              </p>
              <p className="font-mono-archive mt-1 text-xs text-[var(--ink-muted)]">
                {character.id} · Chưa có ảnh
              </p>
            </div>
          ) : (
            <img
              src={character.image}
              alt={`${character.name} — ${character.subtitle}`}
              referrerPolicy="no-referrer"
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover object-top transition-transform duration-700 ease-out group-hover:scale-[1.045]"
            />
          )}

          {/* Measured bottom scrim for crisp legibility */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/75 via-black/30 to-transparent transition-opacity duration-300 group-hover:from-black/84"
          />

          <div className="absolute inset-x-4 bottom-3.5 flex items-end justify-between text-white">
            <span className="font-mono-archive text-[11px] tracking-[0.16em] text-white/85 uppercase">
              {character.id}
            </span>
            <span className="inline-flex translate-y-1 items-center gap-1 text-xs font-medium text-white/95 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              <span>Xem hồ sơ</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </div>
        </button>

        {/* Personal Favorite Heart Button (Member feature; prompts login for Guests) */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            sfx.play('favorite');
            onToggleFavorite(character.id);
          }}
          aria-label={
            isFavorited
              ? `Bỏ lưu ${character.name} khỏi mục yêu thích`
              : `Lưu ${character.name} vào mục yêu thích`
          }
          aria-pressed={isFavorited}
          className={`theme-control absolute top-3 left-3 z-20 flex h-9 w-9 items-center justify-center border backdrop-blur-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${
            isFavorited
              ? theme === 'light'
                ? 'border-[#e280a7] bg-[#e280a7] text-white'
                : 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-ink)]'
              : 'border-white/25 bg-black/35 text-white/90 hover:bg-black/55 hover:text-white'
          }`}
        >
          <Heart className="h-4 w-4" fill={isFavorited ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Editorial text details (zero-pill metadata) */}
      <button
        type="button"
        onClick={() => onSelect(character)}
        className="flex flex-1 flex-col justify-between p-5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
      >
        <div>
          <h3 className="font-editorial text-[1.6rem] leading-tight font-semibold tracking-tight text-[var(--ink-primary)] transition-colors duration-200 group-hover:text-[var(--accent-primary)]">
            {character.name}
          </h3>
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-[var(--ink-secondary)]">
            {character.subtitle}
          </p>
        </div>

        <div className="mt-4 border-t border-[var(--border-hairline)] pt-3.5">
          <p className="truncate text-xs text-[var(--ink-muted)]">
            {character.pinned && (
              <>
                <span className="font-medium text-[var(--accent-primary)]">
                  Nổi bật
                </span>
                <span aria-hidden="true" className="mx-1.5 opacity-55">
                  ·
                </span>
              </>
            )}
            {displayTags.map((tag, i) => (
              <span key={`${character.id}-${tag}`}>
                {i > 0 && (
                  <span aria-hidden="true" className="mx-1.5 opacity-55">
                    ·
                  </span>
                )}
                <span>{tag}</span>
              </span>
            ))}
          </p>
        </div>
      </button>
    </motion.article>
  );
}
