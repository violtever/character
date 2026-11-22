import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  type User,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

const driveAuthProvider = new GoogleAuthProvider();
driveAuthProvider.addScope('https://www.googleapis.com/auth/drive');
driveAuthProvider.addScope('https://www.googleapis.com/auth/drive.file');
driveAuthProvider.addScope('https://www.googleapis.com/auth/drive.readonly');
driveAuthProvider.addScope('https://www.googleapis.com/auth/drive.metadata.readonly');
driveAuthProvider.setCustomParameters({ prompt: 'select_account' });

let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
    } else {
      if (onAuthFailure) onAuthFailure();
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
      throw new Error('Failed to get access token from Google Auth');
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
    throw new Error('Không thể tải danh sách tệp từ Google Drive.');
  }
  const data = await res.json();
  return data.files || [];
}

export async function listDriveAudioFiles(token: string): Promise<DriveFileItem[]> {
  const q = encodeURIComponent(
    "(mimeType contains 'audio/' or name contains '.mp3' or name contains '.wav' or name contains '.ogg') and trashed = false"
  );
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime,size,mimeType)&orderBy=createdTime desc`,
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
): Promise<any> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) {
    throw new Error('Không thể tải nội dung tệp sao lưu từ Google Drive.');
  }
  return await res.json();
}
