import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Cloud,
  Download,
  HardDrive,
  RefreshCw,
  Upload,
  Music,
  Play,
} from 'lucide-react';
import type {
  CategoryRecord,
  CharacterRecord,
  GalleryItem,
} from '../types/archive';
import {
  driveSignIn,
  getDriveAccessToken,
  initDriveAuth,
  listDriveBackups,
  listDriveAudioFiles,
  uploadBackupToDrive,
  downloadBackupFromDrive,
  type DriveFileItem,
} from '../utils/driveService';
import { sfx } from '../utils/sfxEngine';
import { musicPlayer } from '../utils/musicEngine';
import {
  seedInitialDatabase,
  saveCharacterAdmin,
} from '../services/archiveService';

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
  const [loadingList, setLoadingList] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

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

  const handleLogin = async () => {
    setLoadingAuth(true);
    try {
      const res = await driveSignIn();
      if (res) {
        setToken(res.accessToken);
        setUserEmail(res.user.email);
        sfx.play('welcomeClick');
        onNotify('Đã kết nối thành công với Google Drive!');
        void fetchBackups(res.accessToken);
        void fetchAudioFiles(res.accessToken);
      }
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Không thể kết nối Google Drive.'
      );
    } finally {
      setLoadingAuth(false);
    }
  };

  const fetchBackups = async (tok: string) => {
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
  };

  const fetchAudioFiles = async (tok: string) => {
    setLoadingAudio(true);
    try {
      const list = await listDriveAudioFiles(tok);
      setAudioFiles(list);
    } catch {
      // Ignore if no audio found
    } finally {
      setLoadingAudio(false);
    }
  };

  useEffect(() => {
    if (token) {
      void fetchBackups(token);
      void fetchAudioFiles(token);
    }
  }, [token]);

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

  const handleRestoreFromDrive = async (fileId: string, fileName: string) => {
    if (!token) return;

    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn khôi phục dữ liệu từ tệp "${fileName}"? Thao tác này sẽ ghi đè hoặc cập nhật cơ sở dữ liệu hiện tại.`
    );
    if (!confirmed) return;

    setRestoringId(fileId);
    try {
      const data = await downloadBackupFromDrive(token, fileId);
      if (!data || !Array.isArray(data.characters)) {
        throw new Error('Tệp sao lưu không đúng định dạng dữ liệu.');
      }

      await seedInitialDatabase(adminUid);
      for (const char of data.characters) {
        await saveCharacterAdmin(char, adminUid, false);
      }

      sfx.play('welcomeClick');
      onNotify(
        `Đã khôi phục thành công ${data.characters.length} nhân vật từ Google Drive!`
      );
      window.location.reload();
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : 'Khôi phục từ Google Drive thất bại.'
      );
    } finally {
      setRestoringId(null);
    }
  };

  const handlePlayDriveAudio = (file: DriveFileItem) => {
    if (!token) return;
    const directUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&access_token=${token}`;
    musicPlayer.setCustomTrack(file.name, 'Google Drive Audio', directUrl);
    sfx.play('welcomeClick');
    onNotify(`Đang phát nhạc nền từ Google Drive: "${file.name}"`);
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
          Kết nối tài khoản Google của bạn để sao lưu cơ sở dữ liệu và chọn trực
          tiếp các tệp nhạc `.mp3` trên Google Drive làm nhạc nền cho website.
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
            {loadingAuth ? 'Đang kết nối...' : 'Kết nối Google Drive với quyền'}
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
        <div className="flex items-center justify-between border-b border-[var(--border-hairline)] pb-4">
          <div className="flex items-center gap-2.5">
            <Music className="h-5 w-5 text-[var(--accent-primary)]" />
            <h3 className="font-editorial text-2xl font-semibold">
              Chọn bài hát / Nhạc nền từ Google Drive
            </h3>
          </div>
          <button
            type="button"
            disabled={loadingAudio}
            onClick={() => token && fetchAudioFiles(token)}
            className="theme-control inline-flex h-9 items-center gap-1.5 border border-[var(--border-hairline)] px-3 text-xs text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loadingAudio ? 'animate-spin' : ''}`}
            />
            <span>Làm mới nhạc</span>
          </button>
        </div>

        <div className="mt-4 divide-y divide-[var(--border-hairline)]">
          {audioFiles.map((file) => (
            <div
              key={file.id}
              className="flex flex-col justify-between gap-3 py-3.5 sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-strong)] bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                  <Music className="h-4 w-4" />
                </div>
                <div>
                  <p className="font-medium text-[var(--ink-primary)]">
                    {file.name}
                  </p>
                  <p className="font-mono-archive text-[11px] text-[var(--ink-muted)]">
                    ID: {file.id}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handlePlayDriveAudio(file)}
                className="theme-control inline-flex h-9 items-center gap-1.5 bg-[var(--accent-primary)] px-4 text-xs font-semibold text-[var(--accent-ink)] hover:bg-[var(--accent-hover)]"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Phát làm nhạc nền</span>
              </button>
            </div>
          ))}

          {audioFiles.length === 0 && !loadingAudio && (
            <div className="py-8 text-center text-sm text-[var(--ink-muted)]">
              Không tìm thấy tệp âm thanh nào trong Google Drive của bạn. Bạn có thể tải các bài hát lên thư mục Drive bất kỳ và nhấn "Làm mới nhạc".
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
            onClick={() => token && fetchBackups(token)}
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
                <HardDrive className="h-5 w-5 text-[var(--accent-primary)] shrink-0" />
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
                onClick={() => handleRestoreFromDrive(file.id, file.name)}
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
              Chưa có bản sao lưu nào trên Google Drive. Hãy nhấn "Sao lưu ngay
              lên Drive" phía trên!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
