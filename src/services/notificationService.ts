import {
  collection,
  deleteDoc,
  doc,
  getDoc,
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
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  ForumPost,
  ImportantAnnouncement,
  NotificationType,
  PublicUserProfile,
  UserNotification,
  UserProfile,
} from '../types/archive';

function timestampToMs(value: unknown, fallback = Date.now()): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return fallback;
}

function sanitizeIdPart(raw: string, maxLen = 40): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, maxLen);
  return cleaned || 'id';
}

function mapNotificationDoc(
  id: string,
  data: Record<string, unknown>
): UserNotification {
  const typeRaw = String(data.type ?? 'system');
  const type: NotificationType =
    typeRaw === 'important_post' ||
    typeRaw === 'interaction' ||
    typeRaw === 'warning' ||
    typeRaw === 'system'
      ? typeRaw
      : 'system';

  return {
    id,
    recipientId: String(data.recipientId ?? ''),
    type,
    subtype: String(data.subtype ?? 'general'),
    title: String(data.title ?? ''),
    body: String(data.body ?? ''),
    actorId: String(data.actorId ?? ''),
    actorName: String(data.actorName ?? ''),
    actorPhotoURL: String(data.actorPhotoURL ?? ''),
    postId: String(data.postId ?? ''),
    commentId: String(data.commentId ?? ''),
    violationId: String(data.violationId ?? ''),
    isRead: Boolean(data.isRead),
    createdAt: timestampToMs(data.createdAt),
  };
}

function mapAnnouncementDoc(
  id: string,
  data: Record<string, unknown>
): ImportantAnnouncement {
  return {
    id,
    postId: String(data.postId ?? id),
    title: String(data.title ?? ''),
    excerpt: String(data.excerpt ?? ''),
    authorId: String(data.authorId ?? ''),
    authorName: String(data.authorName ?? 'Quản trị viên'),
    authorPhotoURL: String(data.authorPhotoURL ?? ''),
    active: Boolean(data.active),
    createdAt: timestampToMs(data.createdAt),
    updatedAt: timestampToMs(data.updatedAt),
  };
}

/**
 * Subscribe strictly to the signed-in user's own notifications
 * (enforced server-side by firestore.rules resource.data.recipientId == request.auth.uid).
 */
export function subscribeUserNotifications(
  userId: string,
  onUpdate: (notifications: UserNotification[]) => void
): Unsubscribe {
  const q = query(
    collection(db, 'notifications'),
    where('recipientId', '==', userId)
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => mapNotificationDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.createdAt - a.createdAt);
      onUpdate(list);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, `notifications:${userId}`);
      } catch {
        onUpdate([]);
      }
    }
  );
}

/**
 * Subscribe to public important Admin pinned post announcements for popup display.
 */
export function subscribeImportantAnnouncements(
  onUpdate: (items: ImportantAnnouncement[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'importantAnnouncements'),
    (snap) => {
      const list = snap.docs
        .map((d) =>
          mapAnnouncementDoc(d.id, d.data() as Record<string, unknown>)
        )
        .filter((a) => a.active)
        .sort((a, b) => b.updatedAt - a.updatedAt);
      onUpdate(list);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, 'importantAnnouncements');
      } catch {
        onUpdate([]);
      }
    }
  );
}

/**
 * Creates a deterministic notification document (no-op if identical dedupe ID already exists).
 */
export async function createNotificationDeduped(params: {
  id: string;
  recipientId: string;
  type: NotificationType;
  subtype: string;
  title: string;
  body: string;
  actorId?: string;
  actorName?: string;
  actorPhotoURL?: string;
  postId?: string;
  commentId?: string;
  violationId?: string;
}): Promise<void> {
  const safeId = sanitizeIdPart(params.id, 120);
  const ref = doc(db, 'notifications', safeId);

  try {
    const existing = await getDoc(ref);
    if (existing.exists()) {
      return;
    }
  } catch {
    // Non-owner cannot read recipient's existing doc; proceed to create (rules block overwrite on update anyway)
  }

  try {
    await setDoc(ref, {
      id: safeId,
      recipientId: params.recipientId.slice(0, 128),
      type: params.type,
      subtype: params.subtype.slice(0, 40),
      title: params.title.trim().slice(0, 160),
      body: params.body.trim().slice(0, 500),
      actorId: (params.actorId ?? '').slice(0, 128),
      actorName: (params.actorName ?? '').slice(0, 80),
      actorPhotoURL: (params.actorPhotoURL ?? '').slice(0, 250000),
      postId: (params.postId ?? '').slice(0, 64),
      commentId: (params.commentId ?? '').slice(0, 64),
      violationId: (params.violationId ?? '').slice(0, 64),
      isRead: false,
      createdAt: serverTimestamp(),
    });
  } catch {
    // Fail gracefully if duplicate already exists or notification is non-critical
  }
}

export async function markNotificationRead(
  notificationId: string,
  isRead = true
): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await updateDoc(doc(db, 'notifications', notificationId), { isRead });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markAllNotificationsRead(
  notifications: UserNotification[]
): Promise<void> {
  const unread = notifications.filter((n) => !n.isRead);
  if (unread.length === 0) return;

  try {
    const batch = writeBatch(db);
    unread.slice(0, 250).forEach((item) => {
      batch.update(doc(db, 'notifications', item.id), { isRead: true });
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'notifications/batchRead');
  }
}

export async function deleteUserNotification(
  notificationId: string
): Promise<void> {
  const path = `notifications/${notificationId}`;
  try {
    await deleteDoc(doc(db, 'notifications', notificationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

/**
 * Notify post author when another member likes their post.
 * Never notifies when user likes their own post; deduped by postId + actorId.
 */
export async function notifyPostLike(params: {
  post: ForumPost;
  actor: UserProfile;
}): Promise<void> {
  if (!params.post.authorId || params.post.authorId === params.actor.uid) {
    return;
  }
  const dedupeId = `like_${sanitizeIdPart(params.post.id, 36)}_${sanitizeIdPart(params.actor.uid, 36)}`;
  await createNotificationDeduped({
    id: dedupeId,
    recipientId: params.post.authorId,
    type: 'interaction',
    subtype: 'like',
    title: `${params.actor.displayName} đã thích bài viết của bạn`,
    body: `“${params.post.title.slice(0, 120)}” vừa nhận được một lượt thích mới.`,
    actorId: params.actor.uid,
    actorName: params.actor.displayName,
    actorPhotoURL: params.actor.photoURL || '',
    postId: params.post.id,
  });
}

/**
 * Notify post author (and parent comment author on replies) without self-notifications.
 */
export async function notifyForumCommentInteraction(params: {
  post: ForumPost;
  commentId: string;
  commentText: string;
  actor: UserProfile;
  parentCommentAuthorId?: string;
}): Promise<void> {
  const snippet = params.commentText.trim().slice(0, 140);
  const notified = new Set<string>([params.actor.uid]);

  if (
    params.parentCommentAuthorId &&
    !notified.has(params.parentCommentAuthorId)
  ) {
    notified.add(params.parentCommentAuthorId);
    await createNotificationDeduped({
      id: `rep_${sanitizeIdPart(params.commentId, 48)}_${sanitizeIdPart(params.parentCommentAuthorId, 32)}`,
      recipientId: params.parentCommentAuthorId,
      type: 'interaction',
      subtype: 'reply',
      title: `${params.actor.displayName} đã trả lời bình luận của bạn`,
      body: `Trong “${params.post.title.slice(0, 80)}”: “${snippet}”`,
      actorId: params.actor.uid,
      actorName: params.actor.displayName,
      actorPhotoURL: params.actor.photoURL || '',
      postId: params.post.id,
      commentId: params.commentId,
    });
  }

  if (params.post.authorId && !notified.has(params.post.authorId)) {
    notified.add(params.post.authorId);
    await createNotificationDeduped({
      id: `cmt_${sanitizeIdPart(params.commentId, 48)}_${sanitizeIdPart(params.post.authorId, 32)}`,
      recipientId: params.post.authorId,
      type: 'interaction',
      subtype: 'comment',
      title: `${params.actor.displayName} đã bình luận bài viết của bạn`,
      body: `Trong “${params.post.title.slice(0, 80)}”: “${snippet}”`,
      actorId: params.actor.uid,
      actorName: params.actor.displayName,
      actorPhotoURL: params.actor.photoURL || '',
      postId: params.post.id,
      commentId: params.commentId,
    });
  }
}

/**
 * Admin-only: Publish an Important Pinned Post announcement & broadcast deduped notifications
 * to all registered members (never duplicating for the same postId).
 */
export async function publishImportantPostAnnouncementAdmin(params: {
  postId: string;
  title: string;
  content: string;
  admin: UserProfile;
  publicProfiles: Record<string, PublicUserProfile>;
}): Promise<void> {
  const safePostId = sanitizeIdPart(params.postId, 64);
  const excerpt =
    params.content.trim().replace(/\s+/g, ' ').slice(0, 220) ||
    'Quản trị viên vừa ghim một bài viết quan trọng trên diễn đàn.';

  const announcementRef = doc(db, 'importantAnnouncements', safePostId);
  try {
    const existing = await getDoc(announcementRef);
    if (existing.exists()) {
      await updateDoc(announcementRef, {
        title: params.title.trim().slice(0, 160),
        excerpt,
        authorName: params.admin.displayName.slice(0, 80),
        authorPhotoURL: (params.admin.photoURL || '').slice(0, 250000),
        active: true,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(announcementRef, {
        id: safePostId,
        postId: safePostId,
        title: params.title.trim().slice(0, 160),
        excerpt,
        authorId: params.admin.uid,
        authorName: params.admin.displayName.slice(0, 80),
        authorPhotoURL: (params.admin.photoURL || '').slice(0, 250000),
        active: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      OperationType.WRITE,
      `importantAnnouncements/${safePostId}`
    );
  }

  // Fan out deduped per-account notifications to all known members
  let recipientIds = Object.keys(params.publicProfiles);
  if (recipientIds.length === 0) {
    try {
      const snap = await getDocs(collection(db, 'publicProfiles'));
      recipientIds = snap.docs.map((d) => d.id);
    } catch {
      recipientIds = [];
    }
  }

  const targetUids = Array.from(new Set(recipientIds)).filter(
    (uid) => uid && uid !== params.admin.uid
  );

  // Batch create deduped notifications (chunked by 200 to stay well under Firestore 500 batch limit)
  for (let i = 0; i < targetUids.length; i += 200) {
    const chunk = targetUids.slice(i, i + 200);
    await Promise.all(
      chunk.map((uid) =>
        createNotificationDeduped({
          id: `imp_${sanitizeIdPart(safePostId, 44)}_${sanitizeIdPart(uid, 44)}`,
          recipientId: uid,
          type: 'important_post',
          subtype: 'important_pin',
          title: `Thông báo quan trọng: ${params.title.trim().slice(0, 120)}`,
          body: excerpt,
          actorId: params.admin.uid,
          actorName: params.admin.displayName,
          actorPhotoURL: params.admin.photoURL || '',
          postId: safePostId,
        })
      )
    );
  }
}

export async function deactivateImportantPostAnnouncementAdmin(
  postId: string
): Promise<void> {
  const safePostId = sanitizeIdPart(postId, 64);
  const ref = doc(db, 'importantAnnouncements', safePostId);
  try {
    const existing = await getDoc(ref);
    if (!existing.exists()) return;
    await updateDoc(ref, {
      active: false,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Ignore if announcement doc does not exist
  }
}
