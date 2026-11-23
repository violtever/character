import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  Image as ImageIcon,
  ImagePlus,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import type { GalleryItem } from '../types/archive';
import { compressImageFile } from '../utils/imageCompressor';
import { sfx } from '../utils/sfxEngine';

interface DecorGalleryProps {
  items: GalleryItem[];
  isAdmin: boolean;
  onAddItem?: (item: GalleryItem) => Promise<void> | void;
  onRemoveItem?: (id: string) => Promise<void> | void;
}

export function DecorGallery({
  items,
  isAdmin,
  onAddItem,
  onRemoveItem,
}: DecorGalleryProps) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [addingPhoto, setAddingPhoto] = useState(false);
  const [failedIds, setFailedIds] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);

  const [photoSrc, setPhotoSrc] = useState('');
  const [caption, setCaption] = useState('');
  const [date, setDate] = useState(() => {
    const now = new Date();
    return `Tháng ${now.getMonth() + 1}, ${now.getFullYear()}`;
  });
  const [category, setCategory] = useState('');
  const [span, setSpan] = useState<GalleryItem['span']>('standard');
  const [uploadError, setUploadError] = useState('');

  useEffect(() => {
    if (lightboxIdx === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        sfx.play('close');
        setLightboxIdx(null);
      } else if (e.key === 'ArrowLeft') {
        sfx.play('filterSelect');
        setLightboxIdx((prev) =>
          prev === null ? null : (prev - 1 + items.length) % items.length
        );
      } else if (e.key === 'ArrowRight') {
        sfx.play('filterSelect');
        setLightboxIdx((prev) =>
          prev === null ? null : (prev + 1) % items.length
        );
      }
    };
    window.addEventListener('keydown', handleKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [lightboxIdx, items.length]);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    try {
      const compressed = await compressImageFile(file);
      setPhotoSrc(compressed);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Không thể xử lý tệp ảnh này.'
      );
    }
  };

  const handleCreatePhoto = async (e: FormEvent) => {
    e.preventDefault();
    if (!onAddItem) return;
    if (!photoSrc.trim()) {
      setUploadError('Vui lòng nhập đường dẫn ảnh hoặc tải tệp ảnh lên.');
      return;
    }
    setSubmitting(true);
    try {
      await onAddItem({
        id: `decor-${Date.now()}`,
        image: photoSrc.trim(),
        caption: caption.trim() || 'Khung hình kỷ niệm',
        date: date.trim() || '2026',
        category: category.trim() || 'Trang trí',
        span,
      });
      sfx.play('welcomeClick');
      setPhotoSrc('');
      setCaption('');
      setUploadError('');
      setAddingPhoto(false);
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : 'Không thể lưu ảnh vào thư viện.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const activeLightboxItem =
    lightboxIdx !== null ? items[lightboxIdx] ?? null : null;

  return (
    <section
      id="gallery"
      className="mx-auto max-w-6xl px-5 py-20 sm:px-8 lg:py-24"
    >
      {/* Editorial Section Header */}
      <div className="flex flex-col justify-between gap-5 border-b border-[var(--border-hairline)] pb-7 md:flex-row md:items-end">
        <div>
          <p className="font-mono-archive text-xs tracking-[0.2em] text-[var(--ink-muted)] uppercase">
            02. Thư viện ảnh trang trí độc lập
          </p>
          <h2 className="font-editorial mt-2 text-balance text-3xl font-semibold tracking-tight text-[var(--ink-primary)] sm:text-5xl">
            Góc ảnh kỷ niệm &amp; cảm hứng
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-[var(--ink-secondary)]">
            Không gian riêng lưu giữ những khung hình hoa cỏ, kiến trúc, ánh
            nắng và màu phim yêu thích — hoàn toàn độc lập với danh sách nhân
            vật.
          </p>
        </div>

        {isAdmin && onAddItem && (
          <button
            type="button"
            onClick={() => {
              sfx.play('filterSelect');
              setAddingPhoto(true);
            }}
            onMouseEnter={() => sfx.play('hover')}
            className="theme-control inline-flex h-10 shrink-0 items-center gap-2 self-start border border-[var(--border-strong)] bg-[var(--bg-surface)] px-4 text-xs font-medium whitespace-nowrap text-[var(--ink-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] md:self-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Thêm ảnh decor</span>
          </button>
        )}
      </div>

      {/* Asymmetric Editorial Bento / Masonry Grid or Clean Intentional Empty State */}
      {items.length === 0 ? (
        <div className="theme-card mt-10 flex flex-col items-center justify-center border border-dashed border-[var(--border-strong)]/60 bg-[var(--bg-surface)]/75 px-6 py-14 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] text-[var(--ink-muted)]">
            <ImageIcon className="h-5 w-5" />
          </div>
          <p className="font-editorial mt-4 text-2xl font-semibold text-[var(--ink-primary)]">
            Chưa có khung hình nào được đăng tải
          </p>
          <p className="mt-1.5 max-w-md text-xs leading-relaxed text-[var(--ink-muted)]">
            {isAdmin
              ? 'Không gian này sẵn sàng để bạn thêm những bức ảnh kỷ niệm và cảm hứng đầu tiên.'
              : 'Những khung hình kỷ niệm sẽ xuất hiện tại đây ngay khi được cập nhật.'}
          </p>
          {isAdmin && onAddItem && (
            <button
              type="button"
              onClick={() => {
                sfx.play('filterSelect');
                setAddingPhoto(true);
              }}
              className="theme-control btn-tactile mt-5 inline-flex h-10 items-center gap-2 bg-[var(--accent-primary)] px-5 text-xs font-semibold tracking-wider text-[var(--accent-ink)] uppercase hover:bg-[var(--accent-hover)]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Thêm ảnh đầu tiên</span>
            </button>
          )}
        </div>
      ) : (
        <div className="mt-10 grid auto-rows-[230px] grid-cols-1 gap-5 sm:grid-cols-2 lg:auto-rows-[260px] lg:grid-cols-12">
          {items.map((item, idx) => {
          const spanClasses =
            item.span === 'wide'
              ? 'lg:col-span-7 lg:row-span-1'
              : item.span === 'tall'
                ? 'lg:col-span-5 lg:row-span-2'
                : 'lg:col-span-4 lg:row-span-1';

          const failed = Boolean(failedIds[item.id]);

          return (
            <motion.figure
              key={item.id}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{
                duration: 0.52,
                delay: Math.min(idx * 0.06, 0.24),
                ease: [0.22, 1, 0.36, 1],
              }}
              onMouseEnter={() => sfx.play('hover')}
              className={`theme-card group relative overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-elevated)] ${spanClasses}`}
            >
              <button
                type="button"
                onClick={() => {
                  sfx.play('openCharacter');
                  setLightboxIdx(idx);
                }}
                aria-label={`Xem ảnh: ${item.caption}`}
                className="relative block h-full w-full text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
              >
                {failed || !item.image ? (
                  <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center">
                    <p className="font-editorial text-xl text-[var(--ink-primary)]">
                      {item.caption}
                    </p>
                    <p className="font-mono-archive mt-1 text-xs text-[var(--ink-muted)]">
                      {item.date}
                    </p>
                  </div>
                ) : (
                  <img
                    src={item.image}
                    alt={item.caption}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    onError={() =>
                      setFailedIds((prev) => ({ ...prev, [item.id]: true }))
                    }
                    className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]"
                  />
                )}

                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent opacity-80 transition-opacity duration-300 group-hover:opacity-95"
                />

                <div className="theme-control absolute top-3.5 right-3.5 flex h-8 w-8 items-center justify-center border border-white/25 bg-black/35 text-white opacity-0 backdrop-blur-sm transition-all duration-300 group-hover:opacity-100">
                  <Expand className="h-3.5 w-3.5" />
                </div>

                <figcaption className="absolute inset-x-4 bottom-4 flex flex-col gap-1 text-white">
                  <span className="font-mono-archive text-[10px] tracking-[0.18em] text-white/80 uppercase">
                    {item.category} · {item.date}
                  </span>
                  <span className="font-editorial text-xl leading-snug font-medium text-white">
                    {item.caption}
                  </span>
                </figcaption>
              </button>
            </motion.figure>
          );
          })}
        </div>
      )}

      {/* Fullscreen Lightbox */}
      <AnimatePresence>
        {activeLightboxItem && lightboxIdx !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            role="dialog"
            aria-modal="true"
            aria-label="Trình xem ảnh toàn màn hình"
            onClick={() => {
              sfx.play('close');
              setLightboxIdx(null);
            }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/88 p-4 backdrop-blur-md sm:p-8"
          >
            <div
              className="mb-4 flex w-full max-w-5xl items-center justify-between text-white/85"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="font-mono-archive text-xs tracking-widest uppercase">
                Ảnh {String(lightboxIdx + 1).padStart(2, '0')} /{' '}
                {String(items.length).padStart(2, '0')}
              </span>
              <div className="flex items-center gap-2">
                {isAdmin && onRemoveItem && items.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      sfx.play('close');
                      const removeId = activeLightboxItem.id;
                      setLightboxIdx(null);
                      void onRemoveItem(removeId);
                    }}
                    aria-label="Xóa ảnh khỏi thư viện"
                    className="inline-flex h-9 items-center gap-1.5 rounded-md border border-white/20 px-3 text-xs text-white/85 transition-colors hover:border-red-400 hover:text-red-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Xóa ảnh</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('close');
                    setLightboxIdx(null);
                  }}
                  aria-label="Đóng trình xem ảnh"
                  className="flex h-9 w-9 items-center justify-center rounded-md border border-white/25 text-white transition-colors hover:bg-white/15"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div
              className="relative flex w-full max-w-5xl items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('filterSelect');
                    setLightboxIdx(
                      (lightboxIdx - 1 + items.length) % items.length
                    );
                  }}
                  aria-label="Ảnh trước"
                  className="absolute left-0 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:-left-4"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}

              <motion.img
                key={activeLightboxItem.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                src={activeLightboxItem.image}
                alt={activeLightboxItem.caption}
                referrerPolicy="no-referrer"
                className="max-h-[72vh] max-w-full rounded-xl object-contain shadow-2xl"
              />

              {items.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    sfx.play('filterSelect');
                    setLightboxIdx((lightboxIdx + 1) % items.length);
                  }}
                  aria-label="Ảnh tiếp theo"
                  className="absolute right-0 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:-right-4"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>

            <div
              className="mt-5 text-center text-white"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="font-editorial text-2xl font-medium">
                {activeLightboxItem.caption}
              </p>
              <p className="font-mono-archive mt-1 text-xs tracking-wider text-white/75">
                {activeLightboxItem.category} · {activeLightboxItem.date}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Admin-Only Add Decor Photo Modal */}
      <AnimatePresence>
        {isAdmin && addingPhoto && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Thêm ảnh trang trí"
            onClick={() => setAddingPhoto(false)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim-base)] p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="theme-surface theme-panel w-full max-w-lg border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 text-[var(--ink-primary)] shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-4">
                <h3 className="font-editorial text-2xl font-semibold">
                  Thêm ảnh trang trí mới
                </h3>
                <button
                  type="button"
                  onClick={() => setAddingPhoto(false)}
                  aria-label="Đóng hộp thoại"
                  className="theme-control flex h-8 w-8 items-center justify-center border border-[var(--border-hairline)] text-[var(--ink-secondary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreatePhoto} className="mt-5 space-y-4">
                {uploadError && (
                  <p className="theme-control border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-500">
                    {uploadError}
                  </p>
                )}

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                    Đường dẫn ảnh (URL) hoặc tải tệp lên *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={photoSrc}
                      onChange={(e) => setPhotoSrc(e.target.value)}
                      placeholder="https://... hoặc tải tệp từ thiết bị"
                      className="theme-control flex-1 border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--ink-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                    />
                    <label className="theme-control inline-flex cursor-pointer items-center gap-1.5 border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 text-xs font-medium whitespace-nowrap text-[var(--ink-secondary)] hover:border-[var(--accent-primary)]">
                      <ImagePlus className="h-4 w-4" />
                      <span>Tải ảnh</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                    Chú thích ảnh
                  </label>
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Nhập chú thích ngắn cho khung hình..."
                    className="theme-control w-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--ink-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                      Thời gian
                    </label>
                    <input
                      type="text"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="theme-control w-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--ink-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                      Tỷ lệ khung
                    </label>
                    <select
                      value={span}
                      onChange={(e) =>
                        setSpan(e.target.value as GalleryItem['span'])
                      }
                      className="theme-control w-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--ink-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                    >
                      <option value="standard">Tiêu chuẩn</option>
                      <option value="wide">Khung ngang nổi bật</option>
                      <option value="tall">Khung dọc cao</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                    Nhóm chủ đề
                  </label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Nhập nhóm chủ đề..."
                    className="theme-control w-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--ink-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setAddingPhoto(false)}
                    className="theme-control h-10 border border-[var(--border-hairline)] px-4 text-xs font-medium text-[var(--ink-secondary)]"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="theme-control h-10 bg-[var(--accent-primary)] px-5 text-xs font-semibold tracking-wider text-[var(--accent-ink)] uppercase hover:bg-[var(--accent-hover)] disabled:opacity-60"
                  >
                    {submitting ? 'Đang lưu...' : 'Thêm vào thư viện'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
