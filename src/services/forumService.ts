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
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type {
  ForumComment,
  ForumLike,
  ForumPost,
  PublicUserProfile,
  UserProfile,
} from '../types/archive';

const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return Date.now();
}

export function validateImageUploadFile(
  file: File,
  maxMegabytes = 5
): string | null {
  if (!file) return 'Vui lòng chọn tệp hình ảnh hợp lệ.';
  const lowerType = (file.type || '').toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(lowerType)) {
    return 'Định dạng ảnh không được hỗ trợ. Vui lòng chọn JPG, PNG, WEBP hoặc GIF.';
  }
  const maxBytes = maxMegabytes * 1024 * 1024;
  if (file.size > maxBytes) {
    return `Dung lượng ảnh vượt quá giới hạn ${maxMegabytes} MB. Vui lòng chọn ảnh nhẹ hơn.`;
  }
  return null;
}

function generateForumId(prefix: 'POST' | 'CMT'): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${ts}-${rand}`;
}

export function subscribePublicProfiles(
  onData: (profilesMap: Record<string, PublicUserProfile>) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'publicProfiles'),
    (snap) => {
      const map: Record<string, PublicUserProfile> = {};
      snap.docs.forEach((d) => {
        const data = d.data();
        map[d.id] = {
          uid: d.id,
          displayName:
            typeof data.displayName === 'string'
              ? data.displayName
              : 'Thành viên',
          username: typeof data.username === 'string' ? data.username : '',
          photoURL: typeof data.photoURL === 'string' ? data.photoURL : '',
          role: data.role === 'admin' ? 'admin' : 'user',
          updatedAt: toMillis(data.updatedAt),
        };
      });
      onData(map);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'publicProfiles');
    }
  );
}

export function subscribeForumPosts(
  onData: (posts: ForumPost[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'forumPosts'),
    (snap) => {
      const list: ForumPost[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: typeof data.id === 'string' ? data.id : d.id,
            authorId: typeof data.authorId === 'string' ? data.authorId : '',
            authorRole: (data.authorRole === 'admin' ? 'admin' : 'user') as
              | 'user'
              | 'admin',
            authorName:
              typeof data.authorName === 'string'
                ? data.authorName
                : 'Thành viên',
            authorUsername:
              typeof data.authorUsername === 'string'
                ? data.authorUsername
                : '',
            authorPhotoURL:
              typeof data.authorPhotoURL === 'string'
                ? data.authorPhotoURL
                : '',
            title: typeof data.title === 'string' ? data.title : '',
            content: typeof data.content === 'string' ? data.content : '',
            image: typeof data.image === 'string' ? data.image : '',
            isPinned: Boolean(data.isPinned),
            pinnedAt: typeof data.pinnedAt === 'number' ? data.pinnedAt : 0,
            pinOrder: typeof data.pinOrder === 'number' ? data.pinOrder : 0,
            isFeatured: Boolean(data.isFeatured),
            createdAt: toMillis(data.createdAt),
            updatedAt: toMillis(data.updatedAt),
          };
        })
        .sort((a, b) => b.createdAt - a.createdAt);
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'forumPosts');
    }
  );
}

export function subscribeForumComments(
  onData: (comments: ForumComment[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'forumComments'),
    (snap) => {
      const list: ForumComment[] = snap.docs
        .map((d) => {
          const data = d.data();
          return {
            id: typeof data.id === 'string' ? data.id : d.id,
            postId: typeof data.postId === 'string' ? data.postId : '',
            parentCommentId:
              typeof data.parentCommentId === 'string'
                ? data.parentCommentId
                : '',
            authorId: typeof data.authorId === 'string' ? data.authorId : '',
            authorRole: (data.authorRole === 'admin' ? 'admin' : 'user') as
              | 'user'
              | 'admin',
            authorName:
              typeof data.authorName === 'string'
                ? data.authorName
                : 'Thành viên',
            authorUsername:
              typeof data.authorUsername === 'string'
                ? data.authorUsername
                : '',
            authorPhotoURL:
              typeof data.authorPhotoURL === 'string'
                ? data.authorPhotoURL
                : '',
            content: typeof data.content === 'string' ? data.content : '',
            createdAt: toMillis(data.createdAt),
            updatedAt: toMillis(data.updatedAt),
          };
        })
        .sort((a, b) => a.createdAt - b.createdAt);
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'forumComments');
    }
  );
}

export function subscribeForumLikes(
  onData: (likes: ForumLike[]) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'forumLikes'),
    (snap) => {
      const list: ForumLike[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          postId: typeof data.postId === 'string' ? data.postId : '',
          userId: typeof data.userId === 'string' ? data.userId : '',
          createdAt: toMillis(data.createdAt),
        };
      });
      onData(list);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, 'forumLikes');
    }
  );
}

export interface CreatePostInput {
  user: UserProfile;
  title: string;
  content: string;
  image: string;
  pinOnCreate?: boolean;
  pinOrder?: number;
  featureOnCreate?: boolean;
}

export async function createForumPost(input: CreatePostInput): Promise<string> {
  const title = input.title.trim().slice(0, 160);
  const content = input.content.trim().slice(0, 10000);
  const image = input.image.trim();

  if (!title) throw new Error('Vui lòng nhập tiêu đề bài viết.');
  if (!content) throw new Error('Vui lòng nhập nội dung bài viết.');
  if (image.length > 250000) {
    throw new Error('Ảnh đính kèm vượt quá dung lượng cho phép.');
  }

  const isAdmin = input.user.role === 'admin' && input.user.emailVerified;
  const shouldPin = isAdmin && Boolean(input.pinOnCreate);
  const shouldFeature = isAdmin && Boolean(input.featureOnCreate);
  const safePinOrder = shouldPin
    ? Math.max(0, Math.min(9999, Math.round(input.pinOrder ?? 0)))
    : 0;

  const postId = generateForumId('POST');
  const path = `forumPosts/${postId}`;

  try {
    await setDoc(doc(db, 'forumPosts', postId), {
      id: postId,
      authorId: input.user.uid,
      authorRole: isAdmin ? 'admin' : 'user',
      authorName: input.user.displayName.trim().slice(0, 80) || 'Thành viên',
      authorUsername: input.user.username.trim().slice(0, 32) || 'member',
      authorPhotoURL: (input.user.photoURL || '').slice(0, 250000),
      title,
      content,
      image,
      isPinned: shouldPin,
      pinnedAt: shouldPin ? Date.now() : 0,
      pinOrder: safePinOrder,
      isFeatured: shouldFeature,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return postId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateForumPostContent(params: {
  postId: string;
  user: UserProfile;
  title: string;
  content: string;
  image: string;
}): Promise<void> {
  const title = params.title.trim().slice(0, 160);
  const content = params.content.trim().slice(0, 10000);
  const image = params.image.trim();

  if (!title) throw new Error('Vui lòng nhập tiêu đề bài viết.');
  if (!content) throw new Error('Vui lòng nhập nội dung bài viết.');
  if (image.length > 250000) {
    throw new Error('Ảnh đính kèm vượt quá dung lượng cho phép.');
  }

  const path = `forumPosts/${params.postId}`;
  try {
    await updateDoc(doc(db, 'forumPosts', params.postId), {
      title,
      content,
      image,
      authorName: params.user.displayName.trim().slice(0, 80) || 'Thành viên',
      authorPhotoURL: (params.user.photoURL || '').slice(0, 250000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

/**
 * Admin-only moderation mutation (strictly validated by firestore.rules isAdmin()).
 */
export async function updateForumPostModerationAdmin(params: {
  postId: string;
  isPinned?: boolean;
  pinOrder?: number;
  isFeatured?: boolean;
}): Promise<void> {
  const path = `forumPosts/${params.postId}`;
  const updateData: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (typeof params.isPinned === 'boolean') {
    updateData.isPinned = params.isPinned;
    updateData.pinnedAt = params.isPinned ? Date.now() : 0;
    if (!params.isPinned) {
      updateData.pinOrder = 0;
    }
  }
  if (typeof params.pinOrder === 'number') {
    updateData.pinOrder = Math.max(
      0,
      Math.min(9999, Math.round(params.pinOrder))
    );
  }
  if (typeof params.isFeatured === 'boolean') {
    updateData.isFeatured = params.isFeatured;
  }

  try {
    await updateDoc(doc(db, 'forumPosts', params.postId), updateData);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteForumPost(
  postId: string,
  actingUser: UserProfile
): Promise<void> {
  const path = `forumPosts/${postId}`;
  const isAdmin = actingUser.role === 'admin' && actingUser.emailVerified;

  try {
    // Clean up associated comments & likes that this user is permitted to remove
    if (isAdmin) {
      const [commentsSnap, likesSnap] = await Promise.all([
        getDocs(
          query(collection(db, 'forumComments'), where('postId', '==', postId))
        ),
        getDocs(
          query(collection(db, 'forumLikes'), where('postId', '==', postId))
        ),
      ]);

      const refsToDelete = [
        ...commentsSnap.docs.map((d) => d.ref),
        ...likesSnap.docs.map((d) => d.ref),
      ];

      for (let i = 0; i < refsToDelete.length; i += 20) {
        const batch = writeBatch(db);
        refsToDelete.slice(i, i + 20).forEach((r) => batch.delete(r));
        await batch.commit();
      }
    }

    await deleteDoc(doc(db, 'forumPosts', postId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createForumComment(params: {
  postId: string;
  parentCommentId?: string;
  user: UserProfile;
  content: string;
}): Promise<string> {
  const content = params.content.trim().slice(0, 3000);
  if (!content) throw new Error('Vui lòng nhập nội dung bình luận.');

  const commentId = generateForumId('CMT');
  const isAdmin = params.user.role === 'admin' && params.user.emailVerified;
  const path = `forumComments/${commentId}`;

  try {
    await setDoc(doc(db, 'forumComments', commentId), {
      id: commentId,
      postId: params.postId,
      parentCommentId: (params.parentCommentId || '').slice(0, 64),
      authorId: params.user.uid,
      authorRole: isAdmin ? 'admin' : 'user',
      authorName: params.user.displayName.trim().slice(0, 80) || 'Thành viên',
      authorUsername: params.user.username.trim().slice(0, 32) || 'member',
      authorPhotoURL: (params.user.photoURL || '').slice(0, 250000),
      content,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return commentId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateForumComment(params: {
  commentId: string;
  user: UserProfile;
  content: string;
}): Promise<void> {
  const content = params.content.trim().slice(0, 3000);
  if (!content) throw new Error('Nội dung bình luận không được để trống.');

  const path = `forumComments/${params.commentId}`;
  try {
    await updateDoc(doc(db, 'forumComments', params.commentId), {
      content,
      authorName: params.user.displayName.trim().slice(0, 80) || 'Thành viên',
      authorPhotoURL: (params.user.photoURL || '').slice(0, 250000),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteForumComment(
  commentId: string,
  actingUser: UserProfile,
  allComments: ForumComment[]
): Promise<void> {
  const path = `forumComments/${commentId}`;
  const isAdmin = actingUser.role === 'admin' && actingUser.emailVerified;

  try {
    if (isAdmin) {
      const childReplies = allComments.filter(
        (c) => c.parentCommentId === commentId
      );
      if (childReplies.length > 0) {
        const batch = writeBatch(db);
        childReplies.forEach((reply) => {
          batch.delete(doc(db, 'forumComments', reply.id));
        });
        await batch.commit();
      }
    }
    await deleteDoc(doc(db, 'forumComments', commentId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function toggleForumLike(
  postId: string,
  userId: string,
  currentlyLiked: boolean
): Promise<void> {
  const likeId = `${postId}_${userId}`;
  const path = `forumLikes/${likeId}`;
  const ref = doc(db, 'forumLikes', likeId);

  try {
    if (currentlyLiked) {
      await deleteDoc(ref);
    } else {
      await setDoc(ref, {
        postId,
        userId,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      currentlyLiked ? OperationType.DELETE : OperationType.CREATE,
      path
    );
  }
}
