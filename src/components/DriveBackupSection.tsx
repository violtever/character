import { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Cloud,
  Download,
  FolderOpen,
  HardDrive,
  Loader2,
  Music,
  Play,
  RefreshCw,
  Upload,
} from 'lucide-react';
import type {
  CategoryRecord,
  CharacterRecord,
  GalleryItem,
} from '../types/archive';
import {
  DEFAULT_DRIVE_MUSIC_FOLDER_ID,
  downloadBackupFromDrive,
  driveSignIn,
  fetchDriveAudioObjectUrl,
  getDriveAccessToken,
  initDriveAuth,
  listDriveAudioFiles,
  listDriveBackups,
  uploadBackupToDrive,
  type DriveFileItem,
} from '../utils/driveService';
import { sfx } from '../utils/sfxEngine';
import { musicPlayer } from '../utils/musicEngine';
import { saveCharacterAdmin } from '../services/archiveService';

interface DriveBackupSectionProps {
  adminUid: string;
  characters: CharacterRecord[];
  categories: CategoryRecord[];
  galleryItems: GalleryItem[];
  onNotify: (msg: string) => void;
}

export function DriveBackupSection({
  adminUid,
  characters,
  categories,
  galleryItems,
  onNotify,
}: DriveBackupSectionProps) {
  const [token, setToken] = useState<string | null>(getDriveAccessToken());
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [backups, setBackups] = useState<DriveFileItem[]>([]);
  const [audioFiles, setAudioFiles] = useState<DriveFileItem[]>([]);
  const [musicScope, setMusicScope] = useState<'folder' | 'all'>('folder');
  const [loadingList, setLoadingList] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [pendingRestore, setPendingRestore] = useState<DriveFileItem | null>(
    null
  );

  useEffect(() => {
    const unsub = initDriveAuth(
      (user, tok) => {
        setUserEmail(user.email);
        setToken(tok);
      },
      () => {
        setToken(null);
        setUserEmail(null);
      }
    );
    return () => unsub();
  }, []);

  const fetchBackups = useCallback(
    async (tok: string) => {
      setLoadingList(true);
      try {
        const list = await listDriveBackups(tok);
        setBackups(list);
      } catch (err) {
        onNotify(
          err instanceof Error
            ? err.message
            : 'Không thể tải danh sách sao lưu từ Drive.'
        );
      } finally {
        setLoadingList(false);
      }
    },
    [onNotify]
  );

  const fetchAudioFiles = useCallback(
    async (tok: string, scope: 'folder' | 'all') => {
      setLoadingAudio(true);
      try {
        const list = await listDriveAudioFiles(
          tok,
          scope === 'folder' ? DEFAULT_DRIVE_MUSIC_FOLDER_ID : undefined
        );
        setAudioFiles(list);
      } catch (err) {
        onNotify(
          err instanceof Error
            ? err.message
            : 'Không thể tải danh sách tệp nhạc từ Drive.'
        );
      } finally {
        setLoadingAudio(false);
      }
    },
    [onNotify]
  );

  useEffect(() => {
    if (token) {
      void fetchBackups(token);
      void fetchAudioFiles(token, musicScope);
    }
  }, [token, musicScope, fetchBackups, fetchAudioFiles]);

  const handleLogin = async () => {
    setLoadingAuth(true);
    try {
      const res = await driveSignIn();
      if (res) {
        setToken(res.accessToken);
        setUserEmail(res.user.email);
        sfx.play('welcomeClick');
        onNotify('Đã kết nối thành công với Google Drive!');
      }
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Không thể kết nối Google Drive.'
      );
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleBackupToDrive = async () => {
    if (!token) return;
    setUploading(true);
    try {
      const payload = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        characters,
        categories,
        galleryItems,
      };
      const fileName = `xocyberluv-archive-backup-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      await uploadBackupToDrive(token, payload, fileName);
      sfx.play('welcomeClick');
      onNotify(`Đã sao lưu thư viện thành công lên Google Drive (${fileName})!`);
      void fetchBackups(token);
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Sao lưu lên Google Drive thất bại.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmRestoreFromDrive = async () => {
    if (!token || !pendingRestore) return;
    const target = pendingRestore;
    setPendingRestore(null);
    setRestoringId(target.id);

    try {
      const raw = await downloadBackupFromDrive(token, target.id);
      const data = raw as { characters?: CharacterRecord[] };
      if (!data || !Array.isArray(data.characters)) {
        throw new Error('Tệp sao lưu không đúng định dạng dữ liệu.');
      }

      for (const char of data.characters) {
        await saveCharacterAdmin(char, adminUid, false);
      }

      sfx.play('welcomeClick');
      onNotify(
        `Đã khôi phục thành công ${data.characters.length} nhân vật từ Google Drive!`
      );
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Khôi phục từ Google Drive thất bại.'
      );
    } finally {
      setRestoringId(null);
    }
  };

  const handlePlayDriveAudio = async (file: DriveFileItem) => {
    if (!token) return;
    setLoadingAudioId(file.id);
    try {
      const objectUrl = await fetchDriveAudioObjectUrl(token, file.id);
      const cleanTitle = file.name.replace(/\.[^/.]+$/, '');
      musicPlayer.setCustomTrack(cleanTitle, 'Google Drive', objectUrl);
      sfx.play('welcomeClick');
      onNotify(`Đang phát nhạc nền từ Google Drive: "${cleanTitle}"`);
    } catch (err) {
      onNotify(
        err instanceof Error
          ? err.message
          : 'Không thể tải tệp âm thanh từ Google Drive.'
      );
    } finally {
      setLoadingAudioId(null);
    }
  };

  if (!token) {
    return (
      <div className="theme-card border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[var(--accent-soft)] text-[var(--accent-primary)]">
          <Cloud className="h-6 w-6" />
        </div>
        <h3 className="font-editorial mt-4 text-3xl font-semibold">
          Kết nối Google Drive &amp; Nhạc nền đám mây
        </h3>
        <p className="mx-auto mt-2 max-w-md text-sm text-[var(--ink-secondary)]">
          Kết nối tài khoản Google của bạn để sao lưu cơ sở dữ liệu và phát trực
          tiếp các tệp nhạc từ thư mục Google Drive của bạn làm nhạc nền cho
          website.
        </p>
        <button
          type="button"
          disabled={loadingAuth}
          onClick={handleLogin}
          onMouseEnter={() => sfx.play('hover')}
          className="gsi-material-button mt-6 inline-flex h-12 cursor-pointer items-center justify-center gap-3 rounded-lg border border-[var(--border-strong)] bg-white px-6 text-xs font-semibold text-gray-700 shadow-md hover:bg-gray-50 disabled:opacity-60"
        >
          <div className="gsi-material-button-icon">
            <svg
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="h-4 w-4"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              ></path>
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              ></path>
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              ></path>
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              ></path>
            </svg>
          </div>
          <span>
            {loadingAuth ? 'Đang kết nối...' : 'Sign in with Google'}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Account Card */}
      <div className="theme-card flex flex-col justify-between gap-4 border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6 sm:flex-row sm:items-center">
        <div>
          <p className="font-mono-archive text-[11px] tracking-wider text-[var(--accent-primary)] uppercase">
            Google Drive đã kết nối
          </p>
          <p className="font-editorial mt-1 text-2xl font-semibold">
            Tài khoản: {userEmail}
          </p>
          <p className="text-xs text-[var(--ink-secondary)]">
            Đã sẵn sàng đồng bộ sao lưu và chọn nhạc nền trực tiếp từ Drive.
          </p>
        </div>

        <button
          type="button"
          disabled={uploading}
          onClick={handleBackupToDrive}
          className="theme-control inline-flex h-11 items-center gap-2 bg-[var(--accent-primary)] px-5 text-xs font-semibold tracking-wider text-[var(--accent-ink)] uppercase hover:bg-[var(--accent-hover)] disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          <span>{uploading ? 'Đang tải lên...' : 'Sao lưu ngay lên Drive'}</span>
        </button>
      </div>

      {/* Google Drive Music Selector */}
      <div className="theme-card border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
        <div className="flex flex-col justify-between gap-3 border-b border-[var(--border-hairline)] pb-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2.5">
            <Music className="h-5 w-5 shrink-0 text-[var(--accent-primary)]" />
            <div>
              <h3 className="font-editorial text-2xl font-semibold">
                Nhạc nền từ Google Drive
              </h3>
              <p className="font-mono-archive text-[11px] text-[var(--ink-muted)]">
                {musicScope === 'folder'
                  ? `Thư mục đã liên kết (${DEFAULT_DRIVE_MUSIC_FOLDER_ID})`
                  : 'Tất cả tệp âm thanh trên Google Drive'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                sfx.play('filterSelect');
                setMusicScope((prev) => (prev === 'folder' ? 'all' : 'folder'));
              }}
              className="theme-control inline-flex h-9 items-center gap-1.5 border border-[var(--border-hairline)] px-3 text-xs text-[var(--ink-secondary)] hover:border-[var(--accent-primary)] hover:text-[var(--ink-primary)]"
            >
              <FolderOpen className="h-3.5 w-3.5" />
              <span>
                {musicScope === 'folder' ? 'Xem toàn bộ Drive' : 'Về thư mục nhạc'}
              </span>
            </button>
            <button
              type="button"
              disabled={loadingAudio}
              onClick={() => token && void fetchAudioFiles(token, musicScope)}
              className="theme-control inline-flex h-9 items-center gap-1.5 border border-[var(--border-hairline)] px-3 text-xs text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingAudio ? 'animate-spin' : ''}`}
              />
              <span>Làm mới nhạc</span>
            </button>
          </div>
        </div>

        <div className="mt-4 divide-y divide-[var(--border-hairline)]">
          {audioFiles.map((file) => {
            const isLoadingThis = loadingAudioId === file.id;
            return (
              <div
                key={file.id}
                className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                    <Music className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-[var(--ink-primary)]">
                      {file.name}
                    </p>
                    <p className="font-mono-archive text-[11px] text-[var(--ink-muted)]">
                      {file.mimeType || 'Tệp âm thanh'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isLoadingThis}
                  onClick={() => void handlePlayDriveAudio(file)}
                  className="theme-control inline-flex h-9 shrink-0 items-center gap-1.5 bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)] disabled:opacity-60"
                >
                  {isLoadingThis ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5 fill-current" />
                  )}
                  <span>
                    {isLoadingThis ? 'Đang tải nhạc...' : 'Phát làm nhạc nền'}
                  </span>
                </button>
              </div>
            );
          })}

          {audioFiles.length === 0 && !loadingAudio && (
            <div className="py-8 text-center text-sm text-[var(--ink-muted)]">
              {musicScope === 'folder'
                ? 'Chưa tìm thấy tệp âm thanh nào trong thư mục đã liên kết. Bạn có thể chuyển sang "Xem toàn bộ Drive" hoặc tải tệp .mp3/.ogg/.wav vào thư mục này.'
                : 'Không tìm thấy tệp âm thanh nào trong Google Drive của bạn.'}
            </div>
          )}
        </div>
      </div>

      {/* Backups List */}
      <div className="theme-card border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-6">
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-4">
          <h3 className="font-editorial text-2xl font-semibold">
            Danh sách bản sao lưu trên Google Drive
          </h3>
          <button
            type="button"
            disabled={loadingList}
            onClick={() => token && void fetchBackups(token)}
            className="theme-control inline-flex h-9 items-center gap-1.5 border border-[var(--border-hairline)] px-3 text-xs text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loadingList ? 'animate-spin' : ''}`}
            />
            <span>Làm mới</span>
          </button>
        </div>

        <div className="mt-4 divide-y divide-[var(--border-hairline)]">
          {backups.map((file) => (
            <div
              key={file.id}
              className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-3">
                <HardDrive className="h-5 w-5 shrink-0 text-[var(--accent-primary)]" />
                <div>
                  <p className="font-medium text-[var(--ink-primary)]">
                    {file.name}
                  </p>
                  <p className="font-mono-archive text-[11px] text-[var(--ink-muted)]">
                    Tạo lúc:{' '}
                    {new Date(file.createdTime).toLocaleString('vi-VN')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={restoringId === file.id}
                onClick={() => {
                  sfx.play('filterSelect');
                  setPendingRestore(file);
                }}
                className="theme-control inline-flex h-10 items-center gap-1.5 border border-[var(--border-strong)] px-4 text-xs font-medium text-[var(--ink-primary)] hover:border-[var(--accent-primary)] hover:text-[var(--accent-primary)] disabled:opacity-60"
              >
                <Download className="h-3.5 w-3.5" />
                <span>
                  {restoringId === file.id
                    ? 'Đang khôi phục...'
                    : 'Khôi phục dữ liệu'}
                </span>
              </button>
            </div>
          ))}

          {backups.length === 0 && !loadingList && (
            <div className="py-10 text-center text-sm text-[var(--ink-muted)]">
              Chưa có bản sao lưu nào trên Google Drive. Hãy nhấn “Sao lưu ngay
              lên Drive” phía trên!
            </div>
          )}
        </div>
      </div>

      {/* Custom In-App Confirmation Dialog for Destructive Restore */}
      <AnimatePresence>
        {pendingRestore && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            onClick={() => setPendingRestore(null)}
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
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div>
                  <h3 className="font-editorial text-2xl font-semibold">
                    Xác nhận khôi phục dữ liệu?
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--ink-secondary)]">
                    Bạn sắp khôi phục danh sách nhân vật từ bản sao lưu{' '}
                    <strong>{pendingRestore.name}</strong> trên Google Drive.
                    Các hồ sơ trùng mã sẽ được cập nhật lại theo bản sao lưu này.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setPendingRestore(null)}
                  className="theme-control h-10 border border-[var(--border-hairline)] px-4 text-xs font-medium text-[var(--ink-secondary)]"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmRestoreFromDrive()}
                  className="theme-control h-10 bg-[var(--accent-primary)] px-5 text-xs font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]"
                >
                  Xác nhận khôi phục
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
