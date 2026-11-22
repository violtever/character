import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { MusicTrack } from '../types/archive';

export const MAX_AUDIO_FILE_BYTES = 8 * 1024 * 1024; // 8 MB (~23 Firestore chunks)
const RAW_BYTES_PER_CHUNK = 360_000; // Exact multiple of 3 -> 480,000 base64 chars (< 600,000 rule limit)

const ALLOWED_AUDIO_MIME_PREFIXES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/webm',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/aac',
  'audio/flac',
];

const ALLOWED_AUDIO_EXTENSIONS = ['.mp3', '.ogg', '.wav', '.m4a', '.webm', '.aac', '.flac'];

interface CachedAudioEntry {
  version: number;
  objectUrl: string;
}

const audioBlobCache = new Map<string, CachedAudioEntry>();
const audioInFlightCache = new Map<string, Promise<string>>();

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return Date.now();
}

export function formatAudioFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function inferAudioMimeType(file: File): string {
  if (file.type && file.type.startsWith('audio/')) {
    return file.type.slice(0, 80);
  }
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.wav')) return 'audio/wav';
  if (lower.endsWith('.webm')) return 'audio/webm';
  if (lower.endsWith('.m4a')) return 'audio/mp4';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.flac')) return 'audio/flac';
  return 'audio/mpeg';
}

export function validateAudioFile(file: File): string | null {
  if (!file) {
    return 'Vui lòng chọn một tệp âm thanh hợp lệ.';
  }
  if (file.size <= 0) {
    return 'Tệp âm thanh trống hoặc bị lỗi.';
  }
  if (file.size > MAX_AUDIO_FILE_BYTES) {
    return `Dung lượng tệp vượt quá giới hạn ${formatAudioFileSize(MAX_AUDIO_FILE_BYTES)}. Vui lòng chọn tệp gọn hơn hoặc nén sang MP3/OGG.`;
  }

  const lowerName = file.name.toLowerCase();
  const hasValidExt = ALLOWED_AUDIO_EXTENSIONS.some((ext) =>
    lowerName.endsWith(ext)
  );
  const lowerType = (file.type || '').toLowerCase();
  const hasValidMime = ALLOWED_AUDIO_MIME_PREFIXES.some((mime) =>
    lowerType.startsWith(mime)
  );

  if (!hasValidExt && !hasValidMime) {
    return 'Định dạng âm thanh không được hỗ trợ. Vui lòng chọn tệp MP3, OGG, WAV, M4A, WEBM hoặc AAC.';
  }

  return null;
}

export function validateExternalAudioUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return 'Vui lòng nhập đường dẫn tệp âm thanh.';
  if (trimmed.length > 1000) return 'Đường dẫn âm thanh quá dài (tối đa 1000 ký tự).';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return 'Đường dẫn âm thanh phải bắt đầu bằng https:// hoặc http://.';
    }
    return null;
  } catch {
    if (trimmed.startsWith('/')) return null;
    return 'Đường dẫn âm thanh không hợp lệ.';
  }
}

export function detectAudioDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';

    let settled = false;
    const finish = (seconds: number) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      resolve(Number.isFinite(seconds) && seconds > 0 ? Math.min(7200, Math.round(seconds)) : 0);
    };

    const timer = window.setTimeout(() => finish(0), 6000);

    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      finish(audio.duration);
    };
    audio.onerror = () => {
      window.clearTimeout(timer);
      finish(0);
    };
    audio.src = objectUrl;
  });
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const step = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += step) {
    const slice = bytes.subarray(i, Math.min(i + step, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function encodeAudioFileToChunks(file: File): Promise<string[]> {
  const buffer = await file.arrayBuffer();
  const fullBytes = new Uint8Array(buffer);
  const chunks: string[] = [];

  for (let offset = 0; offset < fullBytes.length; offset += RAW_BYTES_PER_CHUNK) {
    const slice = fullBytes.subarray(
      offset,
      Math.min(offset + RAW_BYTES_PER_CHUNK, fullBytes.length)
    );
    chunks.push(uint8ArrayToBase64(slice));
  }

  if (chunks.length === 0) {
    throw new Error('Không thể đọc dữ liệu từ tệp âm thanh này.');
  }
  if (chunks.length > 40) {
    throw new Error('Tệp âm thanh vượt quá số phân mảnh lưu trữ cho phép.');
  }
  return chunks;
}

function generateTrackId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TRK-${ts}-${rand}`;
}

function normalizeTrackDoc(id: string, data: Record<string, unknown>): MusicTrack {
  const audioType = data.audioType === 'url' ? 'url' : 'chunks';
  return {
    id: String(data.id ?? id),
    title: String(data.title ?? 'Không tiêu đề'),
    artist: String(data.artist ?? 'Nghệ sĩ chưa rõ'),
    description: String(data.description ?? ''),
    cover: String(data.cover ?? ''),
    src: audioType === 'url' ? String(data.audioUrl ?? '') : '',
    audioType,
    audioMimeType: String(data.audioMimeType ?? 'audio/mpeg'),
    audioFileName: String(data.audioFileName ?? ''),
    audioFileSize: typeof data.audioFileSize === 'number' ? data.audioFileSize : 0,
    audioChunkCount:
      typeof data.audioChunkCount === 'number' ? data.audioChunkCount : 0,
    audioVersion: typeof data.audioVersion === 'number' ? data.audioVersion : 1,
    duration: typeof data.duration === 'number' ? data.duration : 0,
    order: typeof data.order === 'number' ? data.order : 0,
    createdBy: String(data.createdBy ?? ''),
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    isBuiltIn: false,
  };
}

/**
 * Real-time public subscription to Admin-managed music tracks.
 * Guests, Users, and Admins can all read the playlist.
 */
export function subscribeTracks(
  onData: (tracks: MusicTrack[], isEmpty: boolean) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'tracks'),
    (snap) => {
      if (snap.empty) {
        onData([], true);
        return;
      }
      const list = snap.docs
        .map((d) => normalizeTrackDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => {
          const orderDiff = (a.order ?? 0) - (b.order ?? 0);
          if (orderDiff !== 0) return orderDiff;
          return (b.createdAt ?? 0) - (a.createdAt ?? 0);
        });
      onData(list, false);
    },
    (err) => {
      console.error('Lỗi đồng bộ danh sách nhạc từ Firestore:', err);
      onData([], true);
    }
  );
}

export function revokeCachedTrackAudio(trackId: string): void {
  const existing = audioBlobCache.get(trackId);
  if (existing) {
    URL.revokeObjectURL(existing.objectUrl);
    audioBlobCache.delete(trackId);
  }
}

/**
 * Downloads ordered base64 audio chunks from Firestore and assembles a playable
 * Blob URL, cached in memory by trackId + audioVersion.
 */
export async function loadTrackAudioBlobUrl(
  trackId: string,
  audioVersion: number,
  mimeType: string
): Promise<string> {
  const cached = audioBlobCache.get(trackId);
  if (cached && cached.version === audioVersion) {
    return cached.objectUrl;
  }

  const cacheKey = `${trackId}:${audioVersion}`;
  const inFlight = audioInFlightCache.get(cacheKey);
  if (inFlight) return inFlight;

  const loader = (async () => {
    const q = query(
      collection(db, 'tracks', trackId, 'audioChunks'),
      where('trackId', '==', trackId)
    );
    const snap = await getDocs(q);
    if (snap.empty) {
      throw new Error('Không tìm thấy dữ liệu âm thanh của bài hát này.');
    }

    const matchingDocs = snap.docs
      .map((d) => d.data() as {
        chunkIndex: number;
        audioVersion: number;
        data: string;
      })
      .filter((c) => c.audioVersion === audioVersion)
      .sort((a, b) => a.chunkIndex - b.chunkIndex);

    const chunksToUse =
      matchingDocs.length > 0
        ? matchingDocs
        : snap.docs
            .map((d) => d.data() as {
              chunkIndex: number;
              audioVersion: number;
              data: string;
            })
            .sort((a, b) => a.chunkIndex - b.chunkIndex);

    if (chunksToUse.length === 0) {
      throw new Error('Dữ liệu âm thanh bài hát không đầy đủ.');
    }

    const byteParts: BlobPart[] = chunksToUse.map((chunk) => {
      const bytes = base64ToUint8Array(chunk.data);
      return bytes.buffer as ArrayBuffer;
    });
    const blob = new Blob(byteParts, { type: mimeType || 'audio/mpeg' });
    const objectUrl = URL.createObjectURL(blob);

    if (cached && cached.objectUrl !== objectUrl) {
      URL.revokeObjectURL(cached.objectUrl);
    }
    audioBlobCache.set(trackId, { version: audioVersion, objectUrl });
    return objectUrl;
  })();

  audioInFlightCache.set(cacheKey, loader);
  try {
    return await loader;
  } finally {
    audioInFlightCache.delete(cacheKey);
  }
}

async function writeChunksForVersion(
  trackId: string,
  audioVersion: number,
  chunks: string[],
  onProgress?: (percent: number) => void
): Promise<string[]> {
  const writtenIds: string[] = [];
  const batchSize = 3;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const slice = chunks.slice(i, i + batchSize);
    const batch = writeBatch(db);
    slice.forEach((chunkData, offset) => {
      const chunkIndex = i + offset;
      const chunkId = `v${audioVersion}_${String(chunkIndex).padStart(3, '0')}`;
      writtenIds.push(chunkId);
      batch.set(doc(db, 'tracks', trackId, 'audioChunks', chunkId), {
        trackId,
        chunkIndex,
        audioVersion,
        data: chunkData,
        createdAt: serverTimestamp(),
      });
    });
    await batch.commit();
    onProgress?.(
      Math.min(95, Math.round(((i + slice.length) / chunks.length) * 90) + 5)
    );
  }

  return writtenIds;
}

async function deleteChunkDocsByIds(
  trackId: string,
  chunkIds: string[]
): Promise<void> {
  if (chunkIds.length === 0) return;
  const batchSize = 20;
  for (let i = 0; i < chunkIds.length; i += batchSize) {
    const batch = writeBatch(db);
    chunkIds.slice(i, i + batchSize).forEach((chunkId) => {
      batch.delete(doc(db, 'tracks', trackId, 'audioChunks', chunkId));
    });
    await batch.commit();
  }
}

async function deleteChunksForTrack(
  trackId: string,
  keepAudioVersion?: number
): Promise<void> {
  const q = query(
    collection(db, 'tracks', trackId, 'audioChunks'),
    where('trackId', '==', trackId)
  );
  const snap = await getDocs(q);
  if (snap.empty) return;

  const idsToDelete = snap.docs
    .filter((d) => {
      if (keepAudioVersion === undefined) return true;
      const ver = (d.data() as { audioVersion?: number }).audioVersion;
      return ver !== keepAudioVersion;
    })
    .map((d) => d.id);

  await deleteChunkDocsByIds(trackId, idsToDelete);
}

export interface CreateTrackPayload {
  title: string;
  artist: string;
  description: string;
  cover: string;
  audioFile?: File | null;
  externalAudioUrl?: string;
  duration?: number;
  order: number;
  adminUid: string;
  onProgress?: (percent: number) => void;
}

export async function createTrackAdmin(
  payload: CreateTrackPayload
): Promise<string> {
  const title = payload.title.trim().slice(0, 120);
  const artist = payload.artist.trim().slice(0, 120);
  const description = payload.description.trim().slice(0, 400);
  const cover = payload.cover.trim();

  if (!title) throw new Error('Vui lòng nhập tên bài hát.');
  if (!artist) throw new Error('Vui lòng nhập tên nghệ sĩ.');
  if (cover.length > 250_000) {
    throw new Error('Ảnh bìa vượt quá dung lượng cho phép. Vui lòng chọn ảnh nhẹ hơn.');
  }

  const trackId = generateTrackId();
  const trackRef = doc(db, 'tracks', trackId);

  if (payload.audioFile) {
    const validationErr = validateAudioFile(payload.audioFile);
    if (validationErr) throw new Error(validationErr);

    payload.onProgress?.(5);
    const [chunks, detectedDuration] = await Promise.all([
      encodeAudioFileToChunks(payload.audioFile),
      payload.duration && payload.duration > 0
        ? Promise.resolve(Math.round(payload.duration))
        : detectAudioDuration(payload.audioFile),
    ]);

    const mimeType = inferAudioMimeType(payload.audioFile);
    const fileName = payload.audioFile.name.slice(0, 180);

    // Create parent track doc first so audioChunks security rule exists(/tracks/{trackId}) passes
    await setDoc(trackRef, {
      id: trackId,
      title,
      artist,
      description,
      cover,
      audioType: 'chunks',
      audioUrl: '',
      audioMimeType: mimeType,
      audioFileName: fileName,
      audioFileSize: payload.audioFile.size,
      audioChunkCount: chunks.length,
      audioVersion: 1,
      duration: Math.max(0, Math.min(7200, detectedDuration)),
      order: Math.max(0, Math.min(99999, Math.round(payload.order))),
      createdBy: payload.adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    let writtenIds: string[] = [];
    try {
      writtenIds = await writeChunksForVersion(
        trackId,
        1,
        chunks,
        payload.onProgress
      );
      payload.onProgress?.(100);
      return trackId;
    } catch (err) {
      // Atomic rollback: remove partial chunks and parent doc to prevent junk data
      try {
        await deleteChunkDocsByIds(trackId, writtenIds);
        await deleteDoc(trackRef);
      } catch {
        // Ignore rollback failure
      }
      throw new Error(
        err instanceof Error
          ? `Tải tệp âm thanh thất bại: ${err.message}`
          : 'Không thể tải tệp âm thanh lên hệ thống. Vui lòng thử lại.'
      );
    }
  }

  // External audio URL fallback
  const urlStr = (payload.externalAudioUrl ?? '').trim();
  const urlErr = validateExternalAudioUrl(urlStr);
  if (urlErr) throw new Error(urlErr);

  payload.onProgress?.(40);
  await setDoc(trackRef, {
    id: trackId,
    title,
    artist,
    description,
    cover,
    audioType: 'url',
    audioUrl: urlStr.slice(0, 1000),
    audioMimeType: 'audio/mpeg',
    audioFileName: '',
    audioFileSize: 0,
    audioChunkCount: 0,
    audioVersion: 1,
    duration: Math.max(0, Math.min(7200, Math.round(payload.duration ?? 0))),
    order: Math.max(0, Math.min(99999, Math.round(payload.order))),
    createdBy: payload.adminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  payload.onProgress?.(100);
  return trackId;
}

export interface UpdateTrackPayload {
  existing: MusicTrack;
  title: string;
  artist: string;
  description: string;
  cover: string;
  newAudioFile?: File | null;
  newExternalAudioUrl?: string;
  duration?: number;
  order?: number;
  onProgress?: (percent: number) => void;
}

export async function updateTrackAdmin(
  payload: UpdateTrackPayload
): Promise<void> {
  const { existing } = payload;
  const title = payload.title.trim().slice(0, 120);
  const artist = payload.artist.trim().slice(0, 120);
  const description = payload.description.trim().slice(0, 400);
  const cover = payload.cover.trim();

  if (!title) throw new Error('Vui lòng nhập tên bài hát.');
  if (!artist) throw new Error('Vui lòng nhập tên nghệ sĩ.');
  if (cover.length > 250_000) {
    throw new Error('Ảnh bìa vượt quá dung lượng cho phép.');
  }

  const trackRef = doc(db, 'tracks', existing.id);
  const currentVersion = existing.audioVersion ?? 1;
  const nextOrder = Math.max(
    0,
    Math.min(99999, Math.round(payload.order ?? existing.order ?? 0))
  );

  // Case 1: Replacing audio with a newly uploaded file from device
  if (payload.newAudioFile) {
    const validationErr = validateAudioFile(payload.newAudioFile);
    if (validationErr) throw new Error(validationErr);

    const nextVersion = currentVersion + 1;
    payload.onProgress?.(5);
    const [chunks, detectedDuration] = await Promise.all([
      encodeAudioFileToChunks(payload.newAudioFile),
      payload.duration && payload.duration > 0
        ? Promise.resolve(Math.round(payload.duration))
        : detectAudioDuration(payload.newAudioFile),
    ]);

    const mimeType = inferAudioMimeType(payload.newAudioFile);
    const fileName = payload.newAudioFile.name.slice(0, 180);

    let writtenNewIds: string[] = [];
    try {
      // Write new version chunks first (zero downtime while old version stays intact)
      writtenNewIds = await writeChunksForVersion(
        existing.id,
        nextVersion,
        chunks,
        payload.onProgress
      );

      await updateDoc(trackRef, {
        title,
        artist,
        description,
        cover,
        audioType: 'chunks',
        audioUrl: '',
        audioMimeType: mimeType,
        audioFileName: fileName,
        audioFileSize: payload.newAudioFile.size,
        audioChunkCount: chunks.length,
        audioVersion: nextVersion,
        duration: Math.max(0, Math.min(7200, detectedDuration)),
        order: nextOrder,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      // Rollback new version chunks if update failed
      try {
        await deleteChunkDocsByIds(existing.id, writtenNewIds);
      } catch {
        // Ignore rollback failure
      }
      throw new Error(
        err instanceof Error
          ? `Không thể thay thế tệp âm thanh: ${err.message}`
          : 'Không thể thay thế tệp âm thanh.'
      );
    }

    // Clean up all old-version audio chunks so there is zero orphaned data
    revokeCachedTrackAudio(existing.id);
    try {
      await deleteChunksForTrack(existing.id, nextVersion);
    } catch {
      // Non-fatal cleanup error
    }
    payload.onProgress?.(100);
    return;
  }

  // Case 2: Replacing audio with an external URL
  if (payload.newExternalAudioUrl && payload.newExternalAudioUrl.trim()) {
    const urlStr = payload.newExternalAudioUrl.trim();
    const urlErr = validateExternalAudioUrl(urlStr);
    if (urlErr) throw new Error(urlErr);

    const nextVersion = currentVersion + 1;
    await updateDoc(trackRef, {
      title,
      artist,
      description,
      cover,
      audioType: 'url',
      audioUrl: urlStr.slice(0, 1000),
      audioMimeType: 'audio/mpeg',
      audioFileName: '',
      audioFileSize: 0,
      audioChunkCount: 0,
      audioVersion: nextVersion,
      duration: Math.max(
        0,
        Math.min(7200, Math.round(payload.duration ?? existing.duration ?? 0))
      ),
      order: nextOrder,
      updatedAt: serverTimestamp(),
    });

    revokeCachedTrackAudio(existing.id);
    try {
      await deleteChunksForTrack(existing.id);
    } catch {
      // Ignore cleanup error
    }
    payload.onProgress?.(100);
    return;
  }

  // Case 3: Metadata-only update (title, artist, description, cover, order)
  await updateDoc(trackRef, {
    title,
    artist,
    description,
    cover,
    order: nextOrder,
    updatedAt: serverTimestamp(),
  });
  payload.onProgress?.(100);
}

/**
 * Deletes both all associated stored audio chunks and the track database document
 * so zero orphaned files remain in storage.
 */
export async function deleteTrackAdmin(trackId: string): Promise<void> {
  revokeCachedTrackAudio(trackId);
  await deleteChunksForTrack(trackId);
  await deleteDoc(doc(db, 'tracks', trackId));
}

export async function reorderTracksAdmin(tracks: MusicTrack[]): Promise<void> {
  const batch = writeBatch(db);
  tracks.forEach((track, idx) => {
    const nextOrder = idx + 1;
    if (track.order !== nextOrder) {
      batch.update(doc(db, 'tracks', track.id), {
        order: nextOrder,
        updatedAt: serverTimestamp(),
      });
    }
  });
  await batch.commit();
}
