import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  Shield,
  Trash2,
  User,
} from 'lucide-react';
import { updateOwnProfile } from '../services/archiveService';
import { validateImageUploadFile } from '../services/forumService';
import type { ThemeMode, UserProfile } from '../types/archive';
import { compressImageFile } from '../utils/imageCompressor';
import { sfx } from '../utils/sfxEngine';

interface ProfileSettingsViewProps {
  theme: ThemeMode;
  currentUser: UserProfile;
  onProfileUpdated: (updated: UserProfile) => void;
  onBack: () => void;
  onNotify: (message: string) => void;
}

export function ProfileSettingsView({
  theme,
  currentUser,
  onProfileUpdated,
  onBack,
  onNotify,
}: ProfileSettingsViewProps) {
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [photoURL, setPhotoURL] = useState(currentUser.photoURL || '');
  const [processingAvatar, setProcessingAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDisplayName(currentUser.displayName);
    setPhotoURL(currentUser.photoURL || '');
    setError('');
  }, [currentUser.uid, currentUser.displayName, currentUser.photoURL]);

  const hasChanges =
    displayName.trim() !== currentUser.displayName.trim() ||
    photoURL.trim() !== (currentUser.photoURL || '').trim();

  const previewInitial = (displayName.trim() || currentUser.username || 'U')
    .charAt(0)
    .toUpperCase();

  const handleAvatarFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setError('');
    const validationErr = validateImageUploadFile(file, 5);
    if (validationErr) {
      setError(validationErr);
      return;
    }

    setProcessingAvatar(true);
    try {
      const compressed = await compressImageFile(file, 360, 0.84);
      setPhotoURL(compressed);
      sfx.play('filterSelect');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể xử lý ảnh đại diện. Vui lòng thử ảnh khác.'
      );
    } finally {
      setProcessingAvatar(false);
    }
  };

  const handleCancelChanges = () => {
    sfx.play('close');
    setDisplayName(currentUser.displayName);
    setPhotoURL(currentUser.photoURL || '');
    setError('');
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = displayName.trim();
    if (!cleanName) {
      setError('Tên hiển thị không được để trống.');
      return;
    }
    if (cleanName.length < 2) {
      setError('Tên hiển thị cần tối thiểu 2 ký tự.');
      return;
    }
    if (!currentUser.emailVerified) {
      setError('Vui lòng xác minh địa chỉ email trước khi cập nhật hồ sơ.');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateOwnProfile({
        user: currentUser,
        displayName: cleanName,
        photoURL,
      });
      sfx.play('welcomeClick');
      onProfileUpdated(updated);
      onNotify(
        'Đã lưu hồ sơ của bạn! Tên hiển thị và ảnh đại diện mới đã đồng bộ toàn trang.'
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Không thể lưu thay đổi hồ sơ lúc này. Vui lòng thử lại.'
      );
    } finally {
      setSaving(false);
    }
  };

  const isAdmin = currentUser.role === 'admin' && currentUser.emailVerified;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="relative z-10 mx-auto w-full max-w-4xl px-5 pt-10 pb-20 sm:px-8"
    >
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border-hairline)] pb-6">
        <div>
          <p className="font-mono-archive text-[11px] tracking-[0.22em] text-[var(--accent-primary)] uppercase">
            HỒ SƠ CÁ NHÂN · ĐỒNG BỘ TÀI KHOẢN
          </p>
          <h1 className="font-editorial mt-1.5 text-4xl font-semibold text-[var(--ink-primary)]">
            Hồ sơ của tôi
          </h1>
          <p className="mt-1 text-sm text-[var(--ink-secondary)]">
            Cập nhật tên hiển thị và ảnh đại diện. Thay đổi sẽ tự động đồng bộ
            trên thanh điều hướng, diễn đàn, bài đăng và bình luận.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            sfx.play('close');
            onBack();
          }}
          className="theme-control inline-flex h-10 shrink-0 items-center gap-1.5 border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 text-xs font-medium whitespace-nowrap text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Quay lại</span>
        </button>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Form Column */}
        <form
          onSubmit={handleSubmit}
          className="theme-card space-y-6 border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:p-8 lg:col-span-7"
        >
          {error && (
            <div className="theme-control flex items-start gap-2 border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs text-red-500">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Avatar Upload Block */}
          <div>
            <label className="mb-2 block text-xs font-semibold text-[var(--ink-primary)]">
              Ảnh đại diện
            </label>
            <div className="flex flex-wrap items-center gap-5">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border-2 border-[var(--border-strong)] bg-[var(--accent-soft)] shadow-sm">
                {photoURL ? (
                  <img
                    src={photoURL}
                    alt={displayName || currentUser.displayName}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-editorial text-3xl font-semibold text-[var(--accent-primary)]">
                    {previewInitial}
                  </div>
                )}
                {processingAvatar && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-white">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="theme-control inline-flex h-9 cursor-pointer items-center gap-1.5 bg-[var(--accent-primary)] px-4 text-xs font-semibold whitespace-nowrap text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]">
                    <Camera className="h-3.5 w-3.5" />
                    <span>
                      {photoURL ? 'Đổi ảnh đại diện' : 'Tải ảnh đại diện'}
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      disabled={processingAvatar || saving}
                      onChange={handleAvatarFileChange}
                      className="sr-only"
                    />
                  </label>

                  {photoURL && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        sfx.play('close');
                        setPhotoURL('');
                      }}
                      className="theme-control inline-flex h-9 items-center gap-1.5 border border-[var(--border-hairline)] px-3 text-xs font-medium text-[var(--ink-muted)] hover:border-red-500/50 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Gỡ ảnh</span>
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-[var(--ink-muted)]">
                  Hỗ trợ JPG, PNG, WEBP, GIF · Tối đa 5 MB. Ảnh được tự động tối
                  ưu kích thước và xem trước ngay bên cạnh.
                </p>
              </div>
            </div>
          </div>

          {/* Editable Display Name */}
          <div>
            <label
              htmlFor="profile-display-name"
              className="mb-1.5 block text-xs font-semibold text-[var(--ink-primary)]"
            >
              Tên hiển thị *
            </label>
            <input
              id="profile-display-name"
              type="text"
              required
              minLength={2}
              maxLength={80}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nhập tên hiển thị của bạn..."
              className="theme-control w-full border border-[var(--border-hairline)] bg-[var(--bg-canvas)] px-3.5 py-2.5 text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)] focus:border-[var(--accent-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent-soft)]"
            />
            <p className="mt-1 text-[11px] text-[var(--ink-muted)]">
              {displayName.trim().length}/80 ký tự
            </p>
          </div>

          {/* Immutable Account Fields (Protected by Backend Security Rules) */}
          <div className="space-y-3 border-t border-[var(--border-hairline)] pt-5">
            <p className="font-mono-archive flex items-center gap-1.5 text-[11px] tracking-wider text-[var(--ink-muted)] uppercase">
              <Lock className="h-3 w-3" />
              <span>Thông tin định danh được khóa bảo vệ</span>
            </p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="theme-control border border-[var(--border-hairline)] bg-[var(--bg-canvas)]/70 px-3.5 py-2.5">
                <p className="flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)]">
                  <User className="h-3 w-3" />
                  <span>Tên tài khoản</span>
                </p>
                <p className="font-mono-archive mt-0.5 truncate text-xs font-medium text-[var(--ink-primary)]">
                  @{currentUser.username}
                </p>
              </div>

              <div className="theme-control border border-[var(--border-hairline)] bg-[var(--bg-canvas)]/70 px-3.5 py-2.5">
                <p className="flex items-center gap-1.5 text-[11px] text-[var(--ink-muted)]">
                  <Mail className="h-3 w-3" />
                  <span>Email đăng nhập</span>
                </p>
                <p className="mt-0.5 truncate text-xs font-medium text-[var(--ink-primary)]">
                  {currentUser.email}
                </p>
              </div>
            </div>

            <div className="theme-control flex items-center justify-between border border-[var(--border-hairline)] bg-[var(--bg-canvas)]/70 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 text-[var(--accent-primary)]" />
                <span className="text-xs text-[var(--ink-secondary)]">
                  Vai trò tài khoản
                </span>
              </div>
              <span className="font-mono-archive text-xs font-semibold text-[var(--accent-primary)]">
                {isAdmin ? 'QUẢN TRỊ VIÊN (ADMIN)' : 'THÀNH VIÊN (USER)'}
              </span>
            </div>
          </div>

          {/* Save / Cancel Actions */}
          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[var(--border-hairline)] pt-5">
            <button
              type="button"
              disabled={!hasChanges || saving}
              onClick={handleCancelChanges}
              className="theme-control h-10 border border-[var(--border-hairline)] px-4 text-xs font-medium text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)] disabled:opacity-40"
            >
              Hủy thay đổi
            </button>

            <button
              type="submit"
              disabled={!hasChanges || saving || processingAvatar}
              className="theme-control inline-flex h-10 items-center gap-2 bg-[var(--accent-primary)] px-6 text-xs font-semibold tracking-wider text-[var(--accent-ink)] uppercase hover:bg-[var(--accent-hover)] disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )}
              <span>{saving ? 'Đang lưu...' : 'Lưu hồ sơ'}</span>
            </button>
          </div>
        </form>

        {/* Live Preview Column */}
        <aside className="space-y-5 lg:col-span-5">
          <div className="theme-card border border-[var(--border-strong)] bg-[var(--bg-surface)] p-6">
            <p className="font-mono-archive text-[11px] tracking-widest text-[var(--accent-primary)] uppercase">
              Xem trước hiển thị trực tiếp
            </p>

            {/* Preview as Forum Author Card */}
            <div className="mt-4 rounded-xl border border-[var(--border-hairline)] bg-[var(--bg-canvas)] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-strong)] bg-[var(--accent-soft)] text-base font-semibold text-[var(--accent-primary)]">
                  {photoURL ? (
                    <img
                      src={photoURL}
                      alt={displayName}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    previewInitial
                  )}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[var(--ink-primary)]">
                      {displayName.trim() || 'Tên hiển thị'}
                    </p>
                    {isAdmin ? (
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono-archive text-[10px] font-bold tracking-wider bg-[var(--accent-primary)] text-[var(--accent-ink)] uppercase">
                        <Shield className="h-2.5 w-2.5" />
                        ADMIN
                      </span>
                    ) : (
                      <span className="font-mono-archive text-[10px] text-[var(--ink-muted)]">
                        Thành viên
                      </span>
                    )}
                  </div>
                  <p className="font-mono-archive truncate text-[11px] text-[var(--ink-muted)]">
                    @{currentUser.username} · Vừa xong
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-[var(--ink-secondary)]">
                Đây là cách tên hiển thị và ảnh đại diện của bạn sẽ xuất hiện
                trên thanh đầu trang, bài đăng diễn đàn và bình luận ở giao diện{' '}
                {theme === 'dark' ? 'Wine Archive tối' : 'Pastel Sky sáng'}.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </motion.section>
  );
}
