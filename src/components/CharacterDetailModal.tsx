import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Feather,
  Heart,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import type { CharacterRecord, ThemeMode } from '../types/archive';
import { sfx } from '../utils/sfxEngine';
import { getSafeExternalUrl } from '../utils/urlSafety';

interface CharacterDetailModalProps {
  character: CharacterRecord;
  theme: ThemeMode;
  isAdmin: boolean;
  isFavorited: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasMultiple: boolean;
  onToggleFavorite: (id: string) => void;
  onEdit?: (character: CharacterRecord) => void;
  onDelete?: (id: string) => void;
  onCopyLink: (url: string) => void;
}

export function CharacterDetailModal({
  character,
  theme,
  isAdmin,
  isFavorited,
  onClose,
  onPrev,
  onNext,
  hasMultiple,
  onToggleFavorite,
  onEdit,
  onDelete,
  onCopyLink,
}: CharacterDetailModalProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setImgFailed(false);
    setConfirmDelete(false);
    setCopied(false);
  }, [character.id]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        sfx.play('close');
        onClose();
      } else if (e.key === 'ArrowLeft' && hasMultiple) {
        sfx.play('filterSelect');
        onPrev();
      } else if (e.key === 'ArrowRight' && hasMultiple) {
        sfx.play('filterSelect');
        onNext();
      }
    };
    window.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, onPrev, onNext, hasMultiple]);

  const safeLink = getSafeExternalUrl(character.link);
  const showFallback = !character.image || imgFailed;
  const plotParagraphs = character.plot
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const handleCopy = () => {
    if (!safeLink) return;
    onCopyLink(safeLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="character-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim-base)] p-3 backdrop-blur-md sm:p-6 md:p-10"
      onClick={() => {
        sfx.play('close');
        onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 14, scale: 0.985 }}
        transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="theme-surface theme-panel relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden border border-[var(--border-strong)] bg-[var(--bg-surface)] text-[var(--ink-primary)] shadow-2xl"
      >
        {/* Top editorial utility strip */}
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border-hairline)] px-5 py-3.5 sm:px-7">
          <button
            type="button"
            onClick={() => {
              sfx.play('close');
              onClose();
            }}
            onMouseEnter={() => sfx.play('hover')}
            className="inline-flex items-center gap-2 text-xs font-medium tracking-wide whitespace-nowrap text-[var(--ink-secondary)] transition-colors hover:text-[var(--ink-primary)]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Quay lại thư viện</span>
          </button>

          <div className="flex items-center gap-2">
            {hasMultiple && (
              <div className="mr-1 flex items-center gap-1 border-r border-[var(--border-hairline)] pr-3">
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('filterSelect');
                    onPrev();
                  }}
                  aria-label="Nhân vật trước"
                  className="theme-control flex h-8 w-8 items-center justify-center text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('filterSelect');
                    onNext();
                  }}
                  aria-label="Nhân vật tiếp theo"
                  className="theme-control flex h-8 w-8 items-center justify-center text-[var(--ink-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                sfx.play('favorite');
                onToggleFavorite(character.id);
              }}
              aria-label={
                isFavorited
                  ? 'Bỏ lưu khỏi danh sách yêu thích'
                  : 'Lưu vào danh sách yêu thích'
              }
              className={`theme-control flex h-9 items-center gap-1.5 border px-3 text-xs font-medium whitespace-nowrap ${
                isFavorited
                  ? theme === 'light'
                    ? 'border-[#e280a7] bg-[#e280a7] text-white'
                    : 'border-[var(--accent-primary)] bg-[var(--accent-primary)] text-[var(--accent-ink)]'
                  : 'border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]'
              }`}
            >
              <Heart
                className="h-3.5 w-3.5"
                fill={isFavorited ? 'currentColor' : 'none'}
              />
              <span className="hidden sm:inline">
                {isFavorited ? 'Đã thích' : 'Yêu thích'}
              </span>
            </button>

            {isAdmin && onEdit && (
              <button
                type="button"
                onClick={() => {
                  sfx.play('filterSelect');
                  onEdit(character);
                }}
                aria-label={`Chỉnh sửa ${character.name}`}
                className="theme-control flex h-9 w-9 items-center justify-center border border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                sfx.play('close');
                onClose();
              }}
              aria-label="Đóng hồ sơ nhân vật"
              className="theme-control flex h-9 w-9 items-center justify-center border border-[var(--border-hairline)] text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Main Editorial Split Body */}
        <div className="archive-scroll grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-12">
          {/* Left Column: Portrait & Metadata */}
          <motion.div
            key={`portrait-${character.id}`}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col border-b border-[var(--border-hairline)] bg-[var(--bg-canvas)]/60 p-6 lg:col-span-5 lg:border-r lg:border-b-0 lg:p-8"
          >
            <div className="theme-card relative aspect-[3/4] w-full overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-elevated)]">
              {showFallback ? (
                <div className="flex h-full w-full flex-col items-center justify-center px-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--border-strong)] text-[var(--accent-primary)]">
                    <Feather className="h-6 w-6" />
                  </div>
                  <p className="font-editorial mt-4 text-3xl text-[var(--ink-primary)]">
                    {character.name}
                  </p>
                  <p className="font-mono-archive mt-1 text-xs text-[var(--ink-muted)]">
                    Chưa cập nhật ảnh đại diện
                  </p>
                </div>
              ) : (
                <img
                  src={character.image}
                  alt={character.name}
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="h-full w-full object-cover object-top"
                />
              )}
            </div>

            <dl className="mt-6 space-y-3 border-t border-[var(--border-hairline)] pt-5 text-xs">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="font-mono-archive tracking-wider text-[var(--ink-muted)] uppercase">
                  Mã hồ sơ
                </dt>
                <dd className="font-mono-archive text-[var(--ink-primary)]">
                  {character.id}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="font-mono-archive tracking-wider text-[var(--ink-muted)] uppercase">
                  Thể loại chính
                </dt>
                <dd className="font-medium text-[var(--ink-primary)]">
                  {character.genre}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="font-mono-archive tracking-wider text-[var(--ink-muted)] uppercase">
                  Phân loại
                </dt>
                <dd className="text-[var(--ink-secondary)]">
                  {character.pinned ? 'Hồ sơ nổi bật' : 'Hồ sơ lưu trữ'}
                </dd>
              </div>
            </dl>

            {/* Primary External Link & Actions */}
            <div className="mt-6 flex flex-col gap-2.5">
              {safeLink ? (
                <a
                  href={safeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => sfx.play('openCharacter')}
                  onMouseEnter={() => sfx.play('hover')}
                  className="theme-control inline-flex h-11 w-full items-center justify-center gap-2 bg-[var(--accent-primary)] px-5 text-xs font-semibold tracking-[0.1em] whitespace-nowrap text-[var(--accent-ink)] uppercase hover:bg-[var(--accent-hover)]"
                >
                  <span>{character.linkLabel || 'Mở liên kết nhân vật'}</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <div className="theme-control border border-[var(--border-hairline)] px-4 py-2.5 text-center text-xs text-[var(--ink-muted)]">
                  Chưa có liên kết ngoài cho nhân vật này
                </div>
              )}

              <div className="flex items-center gap-2">
                {safeLink && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    onMouseEnter={() => sfx.play('hover')}
                    className="theme-control inline-flex h-10 flex-1 items-center justify-center gap-2 border border-[var(--border-hairline)] px-4 text-xs font-medium whitespace-nowrap text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                        <span>Đã sao chép</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Sao chép liên kết</span>
                      </>
                    )}
                  </button>
                )}

                {isAdmin && onDelete && (
                  !confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => {
                        sfx.play('filterSelect');
                        setConfirmDelete(true);
                      }}
                      className="theme-control inline-flex h-10 items-center justify-center gap-1.5 border border-[var(--border-hairline)] px-3.5 text-xs font-medium whitespace-nowrap text-[var(--ink-muted)] hover:border-red-500/60 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Xóa</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          sfx.play('close');
                          onDelete(character.id);
                        }}
                        className="theme-control h-10 bg-red-600 px-3 text-xs font-medium whitespace-nowrap text-white hover:bg-red-700"
                      >
                        Xác nhận xóa
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="theme-control h-10 border border-[var(--border-hairline)] px-3 text-xs font-medium whitespace-nowrap text-[var(--ink-secondary)]"
                      >
                        Hủy
                      </button>
                    </div>
                  )
                )}
              </div>
            </div>
          </motion.div>

          {/* Right Column: Editorial Prose & Scrollable Plot */}
          <motion.div
            key={`content-${character.id}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col p-6 sm:p-8 lg:col-span-7 lg:p-10"
          >
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[var(--ink-muted)]">
              <span className="font-mono-archive tracking-widest uppercase">
                {character.id}
              </span>
              <span aria-hidden="true">·</span>
              <span>{character.genre}</span>
              {character.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center">
                  <span aria-hidden="true" className="mr-2.5 opacity-55">
                    ·
                  </span>
                  <span>{tag}</span>
                </span>
              ))}
            </div>

            <h2
              id="character-detail-title"
              className="font-editorial mt-3 text-balance text-4xl font-semibold tracking-tight text-[var(--ink-primary)] sm:text-5xl"
            >
              {character.name}
            </h2>

            <p className="font-editorial mt-2 text-xl italic text-[var(--ink-secondary)] sm:text-2xl">
              {character.subtitle}
            </p>

            <div className="my-6 h-px w-full bg-[var(--border-hairline)]" />

            <section>
              <h3 className="font-mono-archive text-[11px] tracking-[0.18em] text-[var(--ink-muted)] uppercase">
                01. Giới thiệu nhân vật
              </h3>
              <p className="mt-3 max-w-prose text-[15px] leading-[1.8] text-[var(--ink-primary)]">
                {character.description}
              </p>
            </section>

            <section className="mt-8 flex flex-1 flex-col">
              <h3 className="font-mono-archive text-[11px] tracking-[0.18em] text-[var(--ink-muted)] uppercase">
                02. Cốt truyện &amp; Bối cảnh
              </h3>
              <div className="archive-scroll mt-4 max-h-[340px] space-y-4 overflow-y-auto pr-3 lg:max-h-[380px]">
                {plotParagraphs.length > 0 ? (
                  plotParagraphs.map((paragraph, idx) => (
                    <p
                      key={idx}
                      className={`max-w-prose text-[15px] leading-[1.85] text-[var(--ink-secondary)] ${
                        idx === 0 ? 'editorial-dropcap' : ''
                      }`}
                    >
                      {paragraph}
                    </p>
                  ))
                ) : (
                  <p className="text-sm italic text-[var(--ink-muted)]">
                    Chưa có ghi chép cốt truyện cho nhân vật này.
                  </p>
                )}
              </div>
            </section>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
