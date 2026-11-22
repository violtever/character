import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  AudioLines,
  CheckCircle2,
  Disc3,
  FileAudio,
  ImagePlus,
  Link2,
  Loader2,
  Music,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Square,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  createTrackAdmin,
  deleteTrackAdmin,
  detectAudioDuration,
  formatAudioFileSize,
  loadTrackAudioBlobUrl,
  MAX_AUDIO_FILE_BYTES,
  reorderTracksAdmin,
  updateTrackAdmin,
  validateAudioFile,
  validateExternalAudioUrl,
} from '../services/musicService';
import type { MusicTrack } from '../types/archive';
import { compressImageFile } from '../utils/imageCompressor';
import { musicPlayer } from '../utils/musicEngine';
import { sfx } from '../utils/sfxEngine';
import { formatTimeClock } from '../utils/urlSafety';

type TrackSortOption = 'order' | 'newest' | 'title' | 'artist';
type AudioSourceMode = 'file' | 'url';

interface MusicManagerSectionProps {
  adminUid: string;
  tracks: MusicTrack[];
  onNotify: (message: string) => void;
}

export function MusicManagerSection({
  adminUid,
  tracks,
  onNotify,
}: MusicManagerSectionProps) {
  // Search & Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<TrackSortOption>('order');

  // Form state (Add or Edit)
  const [editingTrack, setEditingTrack] = useState<MusicTrack | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState('');
  const [audioSourceMode, setAudioSourceMode] =
    useState<AudioSourceMode>('file');
  const [selectedAudioFile, setSelectedAudioFile] = useState<File | null>(null);
  const [selectedAudioPreviewUrl, setSelectedAudioPreviewUrl] = useState<
    string | null
  >(null);
  const [detectedDuration, setDetectedDuration] = useState<number>(0);
  const [externalAudioUrl, setExternalAudioUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Quick audio replacement state per track row
  const [replacingAudioTrackId, setReplacingAudioTrackId] = useState<
    string | null
  >(null);
  const [replaceProgress, setReplaceProgress] = useState(0);

  // Delete confirmation modal
  const [pendingDeleteTrack, setPendingDeleteTrack] =
    useState<MusicTrack | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reorder busy state
  const [reordering, setReordering] = useState(false);

  // Isolated Audition Player state (for "Nghe thử" in Admin)
  const auditionAudioRef = useRef<HTMLAudioElement | null>(null);
  const [auditionId, setAuditionId] = useState<string | null>(null);
  const [auditionLoadingId, setAuditionLoadingId] = useState<string | null>(
    null
  );

  const formSectionRef = useRef<HTMLFormElement | null>(null);
  const audioInputRef = useRef<HTMLInputElement | null>(null);

  // Cleanup preview object URL & audition player on unmount
  useEffect(() => {
    return () => {
      if (auditionAudioRef.current) {
        auditionAudioRef.current.pause();
        auditionAudioRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (selectedAudioPreviewUrl) {
        URL.revokeObjectURL(selectedAudioPreviewUrl);
      }
    };
  }, [selectedAudioPreviewUrl]);

  const stopAudition = () => {
    if (auditionAudioRef.current) {
      auditionAudioRef.current.pause();
      auditionAudioRef.current.removeAttribute('src');
      auditionAudioRef.current = null;
    }
    setAuditionId(null);
    setAuditionLoadingId(null);
  };

  const resetForm = () => {
    setEditingTrack(null);
    setTitle('');
    setArtist('');
    setDescription('');
    setCover('');
    setAudioSourceMode('file');
    setSelectedAudioFile(null);
    setSelectedAudioPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setDetectedDuration(0);
    setExternalAudioUrl('');
    setFormError('');
    setUploadProgress(0);
    if (audioInputRef.current) {
      audioInputRef.current.value = '';
    }
  };

  const startEditingTrack = (track: MusicTrack) => {
    sfx.play('filterSelect');
    setEditingTrack(track);
    setTitle(track.title);
    setArtist(track.artist);
    setDescription(track.description ?? '');
    setCover(track.cover ?? '');
    setAudioSourceMode(track.audioType === 'url' ? 'url' : 'file');
    setSelectedAudioFile(null);
    setSelectedAudioPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setDetectedDuration(track.duration || 0);
    setExternalAudioUrl(track.audioType === 'url' ? track.src : '');
    setFormError('');
    setUploadProgress(0);
    if (audioInputRef.current) {
      audioInputRef.current.value = '';
    }
    formSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSelectAudioFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError('');

    const err = validateAudioFile(file);
    if (err) {
      setFormError(err);
      e.target.value = '';
      return;
    }

    stopAudition();
    setSelectedAudioFile(file);
    const previewUrl = URL.createObjectURL(file);
    setSelectedAudioPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return previewUrl;
    });

    // Auto-fill track title if still blank
    if (!title.trim()) {
      const cleanName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[_-]+/g, ' ')
        .trim();
      setTitle(cleanName.slice(0, 120));
    }

    const dur = await detectAudioDuration(file);
    setDetectedDuration(dur);
  };

  const handleUploadCover = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError('');
    try {
      const compressed = await compressImageFile(file, 480, 0.82);
      setCover(compressed);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : 'Không thể xử lý ảnh bìa bài hát.'
      );
    }
  };

  const handleAuditionLocalDraft = () => {
    if (!selectedAudioPreviewUrl) return;
    if (auditionId === '__draft__') {
      stopAudition();
      return;
    }

    stopAudition();
    musicPlayer.pause();
    const audio = new Audio(selectedAudioPreviewUrl);
    audio.volume = 0.7;
    audio.onended = () => setAuditionId(null);
    audio.onerror = () => {
      setAuditionId(null);
      onNotify('Trình duyệt không thể nghe thử tệp âm thanh này.');
    };
    auditionAudioRef.current = audio;
    void audio
      .play()
      .then(() => setAuditionId('__draft__'))
      .catch(() => {
        setAuditionId(null);
        onNotify('Không thể phát nghe thử tệp âm thanh.');
      });
  };

  const handleAuditionTrack = async (track: MusicTrack) => {
    if (auditionId === track.id) {
      stopAudition();
      return;
    }

    stopAudition();
    musicPlayer.pause();
    setAuditionLoadingId(track.id);

    try {
      let url = track.src;
      if (track.audioType === 'chunks') {
        url = await loadTrackAudioBlobUrl(
          track.id,
          track.audioVersion ?? 1,
          track.audioMimeType || 'audio/mpeg'
        );
      }
      if (!url) {
        throw new Error('Bài hát này chưa có nguồn âm thanh hợp lệ.');
      }

      const audio = new Audio(url);
      audio.volume = 0.72;
      audio.onended = () => setAuditionId(null);
      audio.onerror = () => {
        setAuditionId(null);
        onNotify('Không thể phát nghe thử bài hát này.');
      };
      auditionAudioRef.current = audio;
      await audio.play();
      setAuditionId(track.id);
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Không thể nghe thử bài hát này.'
      );
    } finally {
      setAuditionLoadingId(null);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanTitle = title.trim();
    const cleanArtist = artist.trim();

    if (!cleanTitle) {
      setFormError('Vui lòng nhập tên bài hát.');
      return;
    }
    if (!cleanArtist) {
      setFormError('Vui lòng nhập tên nghệ sĩ.');
      return;
    }

    if (!editingTrack) {
      if (audioSourceMode === 'file') {
        if (!selectedAudioFile) {
          setFormError('Vui lòng chọn tệp âm thanh từ thiết bị trước khi lưu.');
          return;
        }
        const fileErr = validateAudioFile(selectedAudioFile);
        if (fileErr) {
          setFormError(fileErr);
          return;
        }
      } else {
        const urlErr = validateExternalAudioUrl(externalAudioUrl);
        if (urlErr) {
          setFormError(urlErr);
          return;
        }
      }
    } else {
      if (audioSourceMode === 'file' && selectedAudioFile) {
        const fileErr = validateAudioFile(selectedAudioFile);
        if (fileErr) {
          setFormError(fileErr);
          return;
        }
      }
      if (
        audioSourceMode === 'url' &&
        externalAudioUrl.trim() &&
        externalAudioUrl.trim() !== editingTrack.src
      ) {
        const urlErr = validateExternalAudioUrl(externalAudioUrl);
        if (urlErr) {
          setFormError(urlErr);
          return;
        }
      }
    }

    setSaving(true);
    setUploadProgress(5);
    stopAudition();

    try {
      if (editingTrack) {
        const isNewUrl =
          audioSourceMode === 'url' &&
          externalAudioUrl.trim().length > 0 &&
          (editingTrack.audioType !== 'url' ||
            externalAudioUrl.trim() !== editingTrack.src);

        await updateTrackAdmin({
          existing: editingTrack,
          title: cleanTitle,
          artist: cleanArtist,
          description,
          cover,
          newAudioFile: audioSourceMode === 'file' ? selectedAudioFile : null,
          newExternalAudioUrl: isNewUrl ? externalAudioUrl.trim() : undefined,
          duration: detectedDuration,
          onProgress: setUploadProgress,
        });
        sfx.play('welcomeClick');
        onNotify(`Đã cập nhật bài hát "${cleanTitle}".`);
        resetForm();
      } else {
        const maxOrder = tracks.reduce(
          (acc, t) => Math.max(acc, t.order ?? 0),
          0
        );
        await createTrackAdmin({
          title: cleanTitle,
          artist: cleanArtist,
          description,
          cover,
          audioFile: audioSourceMode === 'file' ? selectedAudioFile : null,
          externalAudioUrl:
            audioSourceMode === 'url' ? externalAudioUrl.trim() : undefined,
          duration: detectedDuration,
          order: maxOrder + 1,
          adminUid,
          onProgress: setUploadProgress,
        });
        sfx.play('welcomeClick');
        onNotify(
          `Đã thêm bài hát "${cleanTitle}" vào danh sách phát của website!`
        );
        resetForm();
      }
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Không thể lưu bài hát. Vui lòng kiểm tra quyền quản trị hoặc thử lại.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleQuickReplaceAudio = async (
    track: MusicTrack,
    e: ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const validationErr = validateAudioFile(file);
    if (validationErr) {
      onNotify(validationErr);
      return;
    }

    stopAudition();
    setReplacingAudioTrackId(track.id);
    setReplaceProgress(5);

    try {
      await updateTrackAdmin({
        existing: track,
        title: track.title,
        artist: track.artist,
        description: track.description ?? '',
        cover: track.cover,
        newAudioFile: file,
        onProgress: setReplaceProgress,
      });
      sfx.play('welcomeClick');
      onNotify(`Đã thay thế tệp âm thanh mới cho bài hát "${track.title}".`);
    } catch (err) {
      onNotify(
        err instanceof Error
          ? err.message
          : 'Không thể thay thế tệp âm thanh lúc này.'
      );
    } finally {
      setReplacingAudioTrackId(null);
      setReplaceProgress(0);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDeleteTrack) return;
    const target = pendingDeleteTrack;
    setDeleting(true);
    if (auditionId === target.id) {
      stopAudition();
    }
    try {
      await deleteTrackAdmin(target.id);
      if (editingTrack?.id === target.id) {
        resetForm();
      }
      sfx.play('close');
      onNotify(
        `Đã xóa bài hát "${target.title}" cùng tệp âm thanh lưu trữ khỏi hệ thống.`
      );
      setPendingDeleteTrack(null);
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Không thể xóa bài hát này.'
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleMoveTrack = async (index: number, direction: -1 | 1) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= tracks.length) return;
    setReordering(true);
    try {
      const reordered = [...tracks];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, moved);
      await reorderTracksAdmin(reordered);
      sfx.play('filterSelect');
    } catch {
      onNotify('Không thể sắp xếp lại thứ tự bài hát lúc này.');
    } finally {
      setReordering(false);
    }
  };

  const filteredAndSortedTracks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const matched = q
      ? tracks.filter((t) =>
          [t.title, t.artist, t.description ?? '', t.audioFileName ?? '']
            .join(' ')
            .toLowerCase()
            .includes(q)
        )
      : tracks;

    return [...matched].sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title, 'vi');
      }
      if (sortBy === 'artist') {
        return a.artist.localeCompare(b.artist, 'vi');
      }
      if (sortBy === 'newest') {
        return (b.createdAt ?? 0) - (a.createdAt ?? 0);
      }
      const orderDiff = (a.order ?? 0) - (b.order ?? 0);
      if (orderDiff !== 0) return orderDiff;
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });
  }, [tracks, searchQuery, sortBy]);

  const inputClass =
    'theme-control w-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]';

  return (
    <div className="space-y-8">
      {/* ================================================================
          ADD / EDIT TRACK FORM + LIVE PLAYER CARD PREVIEW
         ================================================================ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <form
          ref={formSectionRef}
          onSubmit={handleSubmit}
          className="theme-card space-y-5 border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 lg:col-span-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-hairline)] pb-4">
            <div>
              <p className="font-mono-archive text-[11px] tracking-widest text-[var(--accent-primary)] uppercase">
                {editingTrack
                  ? `ĐANG CHỈNH SỬA · ${editingTrack.id}`
                  : 'QUẢN LÝ THƯ VIỆN NHẠC · CHỈ ADMIN'}
              </p>
              <h2 className="font-editorial mt-1 text-3xl font-semibold">
                {editingTrack ? 'Chỉnh sửa bài hát' : 'Thêm bài hát mới'}
              </h2>
            </div>

            {editingTrack && (
              <button
                type="button"
                onClick={resetForm}
                className="theme-control inline-flex h-9 items-center gap-1.5 border border-[var(--border-hairline)] px-3 text-xs font-medium text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
              >
                <X className="h-3.5 w-3.5" />
                <span>Hủy chỉnh sửa</span>
              </button>
            )}
          </div>

          {formError && (
            <div className="theme-control flex items-start gap-2 border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-500">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Title & Artist */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                Tên bài hát *
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Nocturne in Porcelain"
                className={inputClass}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
                Tên nghệ sĩ *
              </label>
              <input
                type="text"
                required
                maxLength={120}
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                placeholder="Ví dụ: Lamp, Ichiko Aoba..."
                className={inputClass}
              />
            </div>
          </div>

          {/* Audio Source Mode Switcher */}
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium text-[var(--ink-secondary)]">
                {editingTrack
                  ? 'Tệp âm thanh (chọn tệp mới nếu muốn thay thế)'
                  : 'Tệp âm thanh *'}
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setAudioSourceMode('file')}
                  className={`theme-control inline-flex h-7 items-center gap-1 px-2.5 text-[11px] font-medium ${
                    audioSourceMode === 'file'
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-ink)]'
                      : 'border border-[var(--border-hairline)] text-[var(--ink-secondary)]'
                  }`}
                >
                  <Upload className="h-3 w-3" />
                  <span>Tải từ thiết bị</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAudioSourceMode('url')}
                  className={`theme-control inline-flex h-7 items-center gap-1 px-2.5 text-[11px] font-medium ${
                    audioSourceMode === 'url'
                      ? 'bg-[var(--accent-primary)] text-[var(--accent-ink)]'
                      : 'border border-[var(--border-hairline)] text-[var(--ink-secondary)]'
                  }`}
                >
                  <Link2 className="h-3 w-3" />
                  <span>Đường dẫn URL</span>
                </button>
              </div>
            </div>

            {audioSourceMode === 'file' ? (
              <div className="theme-control border border-dashed border-[var(--border-strong)] bg-[var(--bg-canvas)] p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-hairline)] bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                      <FileAudio className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      {selectedAudioFile ? (
                        <>
                          <p className="truncate text-xs font-semibold text-[var(--ink-primary)]">
                            {selectedAudioFile.name}
                          </p>
                          <p className="font-mono-archive text-[11px] text-[var(--ink-muted)]">
                            {formatAudioFileSize(selectedAudioFile.size)}
                            {detectedDuration > 0 &&
                              ` · ${formatTimeClock(detectedDuration)}`}
                          </p>
                        </>
                      ) : editingTrack ? (
                        <>
                          <p className="truncate text-xs font-medium text-[var(--ink-primary)]">
                            Đang giữ âm thanh hiện tại:{' '}
                            {editingTrack.audioFileName || 'Nguồn âm thanh đã lưu'}
                          </p>
                          <p className="font-mono-archive text-[11px] text-[var(--ink-muted)]">
                            Chọn tệp mới bên phải nếu bạn muốn thay thế file âm thanh
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs font-medium text-[var(--ink-primary)]">
                            Chọn tệp âm thanh từ máy tính hoặc điện thoại
                          </p>
                          <p className="font-mono-archive text-[11px] text-[var(--ink-muted)]">
                            Hỗ trợ MP3, OGG, WAV, M4A, WEBM, AAC · Tối đa{' '}
                            {formatAudioFileSize(MAX_AUDIO_FILE_BYTES)}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {selectedAudioPreviewUrl && (
                      <button
                        type="button"
                        onClick={handleAuditionLocalDraft}
                        className="theme-control inline-flex h-9 items-center gap-1.5 border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 text-xs font-medium text-[var(--ink-primary)] hover:border-[var(--accent-primary)]"
                      >
                        {auditionId === '__draft__' ? (
                          <>
                            <Square className="h-3 w-3 fill-current" />
                            <span>Dừng</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-3 w-3 fill-current" />
                            <span>Nghe thử</span>
                          </>
                        )}
                      </button>
                    )}

                    <label className="theme-control inline-flex h-9 cursor-pointer items-center gap-1.5 bg-[var(--accent-primary)] px-3.5 text-xs font-semibold whitespace-nowrap text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]">
                      <Upload className="h-3.5 w-3.5" />
                      <span>
                        {selectedAudioFile || editingTrack
                          ? 'Chọn tệp khác'
                          : 'Chọn file nhạc'}
                      </span>
                      <input
                        ref={audioInputRef}
                        type="file"
                        accept="audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/webm,audio/mp4,audio/aac,.mp3,.ogg,.wav,.m4a,.webm,.aac,.flac"
                        onChange={handleSelectAudioFile}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <input
                type="url"
                value={externalAudioUrl}
                onChange={(e) => setExternalAudioUrl(e.target.value)}
                placeholder="https://example.com/music/track.mp3"
                className={inputClass}
              />
            )}
          </div>

          {/* Cover Image */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
              Ảnh bìa bài hát (tải từ thiết bị hoặc dán URL)
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={cover}
                onChange={(e) => setCover(e.target.value)}
                placeholder="https://... hoặc chọn ảnh bìa từ máy"
                className={`${inputClass} flex-1`}
              />
              <label className="theme-control inline-flex h-[42px] cursor-pointer items-center justify-center gap-2 border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-4 text-xs font-medium whitespace-nowrap text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]">
                <ImagePlus className="h-4 w-4" />
                <span>Chọn ảnh bìa</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleUploadCover}
                  className="sr-only"
                />
              </label>
              {cover && (
                <button
                  type="button"
                  onClick={() => setCover('')}
                  aria-label="Xóa ảnh bìa"
                  className="theme-control inline-flex h-[42px] items-center justify-center border border-[var(--border-hairline)] px-3 text-xs text-[var(--ink-muted)] hover:border-red-500/50 hover:text-red-500"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Short Description */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[var(--ink-secondary)]">
              Mô tả ngắn (không bắt buộc)
            </label>
            <textarea
              rows={2}
              maxLength={400}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú ngắn về không khí hoặc cảm hứng của bài hát..."
              className={inputClass}
            />
          </div>

          {/* Upload Progress Bar */}
          {saving && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-[var(--ink-secondary)]">
                <span>Đang tải lên và đồng bộ cơ sở dữ liệu...</span>
                <span className="font-mono-archive">{uploadProgress}%</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-hairline)]">
                <div
                  className="h-full bg-[var(--accent-primary)] transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border-hairline)] pt-4">
            <button
              type="button"
              disabled={saving}
              onClick={resetForm}
              className="theme-control h-10 border border-[var(--border-hairline)] px-4 text-xs font-medium text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] disabled:opacity-50"
            >
              Làm mới biểu mẫu
            </button>
            <button
              type="submit"
              disabled={saving}
              className="theme-control inline-flex h-10 items-center gap-2 bg-[var(--accent-primary)] px-6 text-xs font-semibold tracking-wider text-[var(--accent-ink)] uppercase hover:bg-[var(--accent-hover)] disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : editingTrack ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <Plus className="h-3.5 w-3.5" />
              )}
              <span>
                {saving
                  ? 'Đang lưu bài hát...'
                  : editingTrack
                    ? 'Lưu thay đổi'
                    : 'Thêm vào thư viện nhạc'}
              </span>
            </button>
          </div>
        </form>

        {/* Live Music Player Card Preview */}
        <aside className="lg:col-span-4">
          <div className="theme-card sticky top-24 border border-[var(--border-strong)] bg-[var(--bg-surface)] p-5">
            <p className="font-mono-archive text-[11px] tracking-widest text-[var(--accent-primary)] uppercase">
              Xem trước hiển thị Music Player
            </p>

            <div className="theme-card mt-4 aspect-square w-full overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-elevated)]">
              {cover ? (
                <img
                  src={cover}
                  alt={title || 'Xem trước ảnh bìa'}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-[var(--ink-muted)]">
                  <Disc3 className="h-10 w-10 text-[var(--accent-primary)]/60" />
                  <span className="text-xs">Chưa chọn ảnh bìa</span>
                </div>
              )}
            </div>

            <div className="mt-4">
              <h3 className="font-editorial truncate text-2xl font-semibold text-[var(--ink-primary)]">
                {title.trim() || 'Tên bài hát mẫu'}
              </h3>
              <p className="truncate text-xs font-medium text-[var(--ink-secondary)]">
                {artist.trim() || 'Tên nghệ sĩ'}
              </p>
              {description.trim() && (
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[var(--ink-muted)]">
                  {description.trim()}
                </p>
              )}

              <div className="font-mono-archive mt-3 flex items-center justify-between border-t border-[var(--border-hairline)] pt-3 text-[11px] text-[var(--ink-muted)]">
                <span>
                  {detectedDuration > 0
                    ? `Thời lượng: ${formatTimeClock(detectedDuration)}`
                    : 'Thời lượng: tự động nhận diện'}
                </span>
                <span>
                  {selectedAudioFile
                    ? formatAudioFileSize(selectedAudioFile.size)
                    : editingTrack?.audioFileSize
                      ? formatAudioFileSize(editingTrack.audioFileSize)
                      : audioSourceMode === 'url'
                        ? 'URL'
                        : 'Chưa chọn tệp'}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* ================================================================
          UPLOADED TRACKS LIST (SEARCH, SORT, AUDITION, EDIT, REPLACE, DELETE)
         ================================================================ */}
      <div className="theme-card border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-[var(--border-hairline)] pb-5 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono-archive text-[11px] tracking-widest text-[var(--ink-muted)] uppercase">
              DANH SÁCH PHÁT WEBSITE · ĐỒNG BỘ TỨC THÌ
            </p>
            <h3 className="font-editorial mt-1 text-3xl font-semibold">
              Thư viện nhạc đã tải lên ({tracks.length})
            </h3>
            <p className="mt-1 text-xs text-[var(--ink-secondary)]">
              Mọi thay đổi tại đây sẽ cập nhật ngay lập tức trên trình phát nhạc
              cho tất cả khách truy cập và thành viên.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[220px] flex-1 sm:w-64">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--ink-muted)]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm theo tên bài hát, nghệ sĩ..."
                className={`${inputClass} h-10 pl-9 text-xs`}
              />
            </div>

            <select
              aria-label="Sắp xếp danh sách bài hát"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as TrackSortOption)}
              className="theme-control h-10 border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3 text-xs font-medium text-[var(--ink-primary)] focus:border-[var(--accent-primary)] focus:outline-none"
            >
              <option value="order">Thứ tự phát</option>
              <option value="newest">Mới nhất</option>
              <option value="title">Tên bài hát (A — Z)</option>
              <option value="artist">Nghệ sĩ (A — Z)</option>
            </select>
          </div>
        </div>

        <div className="mt-4 divide-y divide-[var(--border-hairline)]">
          {filteredAndSortedTracks.map((track, idx) => {
            const isAuditioning = auditionId === track.id;
            const isLoadingAudition = auditionLoadingId === track.id;
            const isReplacingThis = replacingAudioTrackId === track.id;
            const canReorder =
              sortBy === 'order' && !searchQuery.trim() && tracks.length > 1;

            return (
              <div
                key={track.id}
                className="flex flex-col justify-between gap-4 py-4 lg:flex-row lg:items-center"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  {/* Reorder arrows when viewing natural playback order */}
                  {canReorder && (
                    <div className="flex shrink-0 flex-col gap-0.5">
                      <button
                        type="button"
                        disabled={reordering || idx === 0}
                        onClick={() => void handleMoveTrack(idx, -1)}
                        aria-label="Đưa bài hát lên trên"
                        className="flex h-6 w-6 items-center justify-center rounded border border-[var(--border-hairline)] text-[var(--ink-muted)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)] disabled:opacity-30"
                      >
                        <ArrowUp className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        disabled={reordering || idx === tracks.length - 1}
                        onClick={() => void handleMoveTrack(idx, 1)}
                        aria-label="Đưa bài hát xuống dưới"
                        className="flex h-6 w-6 items-center justify-center rounded border border-[var(--border-hairline)] text-[var(--ink-muted)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)] disabled:opacity-30"
                      >
                        <ArrowDown className="h-3 w-3" />
                      </button>
                    </div>
                  )}

                  {/* Cover */}
                  <div className="theme-control relative h-14 w-14 shrink-0 overflow-hidden border border-[var(--border-hairline)] bg-[var(--bg-elevated)]">
                    {track.cover ? (
                      <img
                        src={track.cover}
                        alt={track.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[var(--accent-primary)]">
                        <Music className="h-5 w-5" />
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--ink-muted)]">
                      <span className="font-mono-archive">
                        #{String(idx + 1).padStart(2, '0')}
                      </span>
                      <span>·</span>
                      <span className="font-mono-archive">
                        {track.duration > 0
                          ? formatTimeClock(track.duration)
                          : '--:--'}
                      </span>
                      {track.audioFileSize ? (
                        <>
                          <span>·</span>
                          <span className="font-mono-archive">
                            {formatAudioFileSize(track.audioFileSize)}
                          </span>
                        </>
                      ) : track.audioType === 'url' ? (
                        <>
                          <span>·</span>
                          <span className="font-mono-archive">Nguồn URL</span>
                        </>
                      ) : null}
                    </div>

                    <h4 className="font-editorial truncate text-2xl font-semibold text-[var(--ink-primary)]">
                      {track.title}
                    </h4>
                    <p className="truncate text-xs text-[var(--ink-secondary)]">
                      {track.artist}
                      {track.description ? ` — ${track.description}` : ''}
                    </p>

                    {isReplacingThis && (
                      <div className="mt-2 max-w-xs space-y-1">
                        <p className="font-mono-archive text-[10px] text-[var(--accent-primary)]">
                          Đang thay thế tệp âm thanh... {replaceProgress}%
                        </p>
                        <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--border-hairline)]">
                          <div
                            className="h-full bg-[var(--accent-primary)] transition-all"
                            style={{ width: `${replaceProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap shrink-0 items-center gap-2">
                  <button
                    type="button"
                    disabled={isLoadingAudition || isReplacingThis}
                    onClick={() => void handleAuditionTrack(track)}
                    className={`theme-control inline-flex h-9 items-center gap-1.5 px-3 text-xs font-medium whitespace-nowrap ${
                      isAuditioning
                        ? 'bg-[var(--accent-primary)] text-[var(--accent-ink)]'
                        : 'border border-[var(--border-strong)] text-[var(--ink-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]'
                    }`}
                  >
                    {isLoadingAudition ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isAuditioning ? (
                      <Pause className="h-3.5 w-3.5" />
                    ) : (
                      <Play className="h-3.5 w-3.5" />
                    )}
                    <span>
                      {isLoadingAudition
                        ? 'Đang tải...'
                        : isAuditioning
                          ? 'Dừng nghe'
                          : 'Nghe thử'}
                    </span>
                  </button>

                  <button
                    type="button"
                    disabled={isReplacingThis}
                    onClick={() => startEditingTrack(track)}
                    className="theme-control inline-flex h-9 items-center gap-1.5 border border-[var(--border-hairline)] px-3 text-xs font-medium whitespace-nowrap text-[var(--ink-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)]"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Chỉnh sửa</span>
                  </button>

                  <label className="theme-control inline-flex h-9 cursor-pointer items-center gap-1.5 border border-[var(--border-hairline)] px-3 text-xs font-medium whitespace-nowrap text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]">
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${isReplacingThis ? 'animate-spin' : ''}`}
                    />
                    <span>Đổi file nhạc</span>
                    <input
                      type="file"
                      disabled={isReplacingThis}
                      accept="audio/mpeg,audio/mp3,audio/ogg,audio/wav,audio/webm,audio/mp4,audio/aac,.mp3,.ogg,.wav,.m4a,.webm,.aac,.flac"
                      onChange={(e) => void handleQuickReplaceAudio(track, e)}
                      className="sr-only"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={isReplacingThis}
                    onClick={() => {
                      sfx.play('filterSelect');
                      setPendingDeleteTrack(track);
                    }}
                    className="theme-control inline-flex h-9 items-center gap-1.5 border border-[var(--border-hairline)] px-3 text-xs font-medium whitespace-nowrap text-[var(--ink-muted)] hover:border-red-500/60 hover:text-red-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Xóa</span>
                  </button>
                </div>
              </div>
            );
          })}

          {filteredAndSortedTracks.length === 0 && (
            <div className="py-12 text-center">
              <AudioLines className="mx-auto h-8 w-8 text-[var(--ink-muted)]/60" />
              <p className="mt-3 text-sm font-medium text-[var(--ink-secondary)]">
                {tracks.length === 0
                  ? 'Chưa có bài hát nào trong thư viện nhạc.'
                  : 'Không tìm thấy bài hát nào khớp với từ khóa tìm kiếm.'}
              </p>
              <p className="mt-1 text-xs text-[var(--ink-muted)]">
                {tracks.length === 0
                  ? 'Hãy tải lên bài hát đầu tiên ở biểu mẫu phía trên — hiện trình phát đang dùng giai điệu lưu trữ mặc định.'
                  : 'Hãy thử tìm với tên bài hát hoặc tên nghệ sĩ khác.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================
          IN-APP DELETE CONFIRMATION MODAL (NO window.confirm)
         ================================================================ */}
      <AnimatePresence>
        {pendingDeleteTrack && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            onClick={() => !deleting && setPendingDeleteTrack(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--scrim-base)] p-4 backdrop-blur-md"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              onClick={(e) => e.stopPropagation()}
              className="theme-surface theme-panel w-full max-w-md border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6 shadow-2xl"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <h3 className="font-editorial text-2xl font-semibold text-[var(--ink-primary)]">
                    Xác nhận xóa bài hát?
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink-secondary)]">
                    Bạn có chắc muốn xóa vĩnh viễn bài hát{' '}
                    <strong>“{pendingDeleteTrack.title}”</strong> (
                    {pendingDeleteTrack.artist}) không? Bản ghi trong cơ sở dữ
                    liệu cùng toàn bộ dữ liệu tệp âm thanh liên quan sẽ được gỡ
                    bỏ khỏi danh sách phát của website.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => setPendingDeleteTrack(null)}
                  className="theme-control h-10 border border-[var(--border-hairline)] px-4 text-xs font-medium text-[var(--ink-secondary)]"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void handleConfirmDelete()}
                  className="theme-control inline-flex h-10 items-center gap-2 bg-red-600 px-5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{deleting ? 'Đang xóa...' : 'Xác nhận xóa'}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
