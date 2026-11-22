import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

export const DEFAULT_DRIVE_MUSIC_FOLDER_ID =
  '1eF1qrz92kDvYGS_9PLqIDh5Wfs_odfWl';

export const DRIVE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.activity',
  'https://www.googleapis.com/auth/drive.activity.readonly',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.apps.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.install',
  'https://www.googleapis.com/auth/drive.meet.readonly',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.scripts',
] as const;

const driveAuthProvider = new GoogleAuthProvider();
DRIVE_SCOPES.forEach((scope) => driveAuthProvider.addScope(scope));
driveAuthProvider.setCustomParameters({ prompt: 'select_account' });

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        onAuthSuccess?.(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        onAuthFailure?.();
      }
    } else {
      cachedAccessToken = null;
      onAuthFailure?.();
    }
  });
};

export const driveSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, driveAuthProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Không nhận được mã truy cập từ Google Auth.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (err) {
    console.error('Drive sign in error:', err);
    throw err;
  } finally {
    isSigningIn = false;
  }
};

export const getDriveAccessToken = (): string | null => {
  return cachedAccessToken;
};

export interface DriveFileItem {
  id: string;
  name: string;
  createdTime: string;
  size?: string;
  mimeType?: string;
}

export async function listDriveBackups(token: string): Promise<DriveFileItem[]> {
  const q = encodeURIComponent(
    "name contains 'xocyberluv-archive-backup' and trashed = false"
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime,size)&orderBy=createdTime desc`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    throw new Error('Không thể tải danh sách tệp sao lưu từ Google Drive.');
  }
  const data = await res.json();
  return data.files || [];
}

export async function listDriveAudioFiles(
  token: string,
  folderId?: string
): Promise<DriveFileItem[]> {
  const audioFilter =
    "(mimeType contains 'audio/' or name contains '.mp3' or name contains '.wav' or name contains '.ogg' or name contains '.m4a')";
  const queryParts = [audioFilter, 'trashed = false'];
  if (folderId && /^[a-zA-Z0-9_-]+$/.test(folderId)) {
    queryParts.unshift(`'${folderId}' in parents`);
  }
  const q = encodeURIComponent(queryParts.join(' and '));
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime,size,mimeType)&orderBy=name&includeItemsFromAllDrives=true&supportsAllDrives=true`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    throw new Error('Không thể tải danh sách tệp âm thanh từ Google Drive.');
  }
  const data = await res.json();
  return data.files || [];
}

export async function fetchDriveAudioObjectUrl(
  token: string,
  fileId: string
): Promise<string> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    throw new Error('Không thể tải tệp nhạc từ Google Drive.');
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function uploadBackupToDrive(
  token: string,
  archiveData: object,
  fileName: string
): Promise<string> {
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
  };
  const fileContent = JSON.stringify(archiveData, null, 2);
  const form = new FormData();
  form.append(
    'metadata',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' })
  );
  form.append('file', new Blob([fileContent], { type: 'application/json' }));

  const res = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Tải tệp lên Google Drive thất bại: ${errText}`);
  }
  const data = await res.json();
  return data.id;
}

export async function downloadBackupFromDrive(
  token: string,
  fileId: string
): Promise<unknown> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    throw new Error('Không thể tải nội dung tệp sao lưu từ Google Drive.');
  }
  return await res.json();
}
