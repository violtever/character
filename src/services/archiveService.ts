import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase';
import { DEFAULT_CATEGORY_SEEDS, INITIAL_CHARACTERS } from '../data/characters';
import { INITIAL_GALLERY_ITEMS } from '../data/gallery';
import type {
  CategoryRecord,
  CharacterRecord,
  GalleryItem,
  UserProfile,
} from '../types/archive';

function toMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === 'number') return value;
  return Date.now();
}

export function slugifyVietnamese(input: string): string {
  return (
    input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || `cat-${Date.now()}`
  );
}

export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 32);
}

export function sanitizeRecordId(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64);
  return cleaned || `ARC-${Date.now().toString().slice(-5)}`;
}

/**
 * Live subscriptions for public archive data (readable by Guest, User, Admin)
 */
export function subscribeCharacters(
  onData: (records: CharacterRecord[], isEmptyInDb: boolean) => void
): () => void {
  const path = 'characters';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onData(INITIAL_CHARACTERS, true);
        return;
      }
      const list: CharacterRecord[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: typeof data.id === 'string' ? data.id : d.id,
          name: typeof data.name === 'string' ? data.name : '',
          image: typeof data.image === 'string' ? data.image : '',
          subtitle: typeof data.subtitle === 'string' ? data.subtitle : '',
          genre: typeof data.genre === 'string' ? data.genre : 'Khác',
          tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
          description:
            typeof data.description === 'string' ? data.description : '',
          plot: typeof data.plot === 'string' ? data.plot : '',
          link: typeof data.link === 'string' ? data.link : '',
          linkLabel:
            typeof data.linkLabel === 'string' ? data.linkLabel : undefined,
          pinned: Boolean(data.pinned),
          createdBy:
            typeof data.createdBy === 'string' ? data.createdBy : undefined,
          createdAt: toMillis(data.createdAt),
          updatedAt: toMillis(data.updatedAt),
        };
      });
      onData(list, false);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeCategories(
  onData: (categories: CategoryRecord[], isEmptyInDb: boolean) => void
): () => void {
  const path = 'categories';
  const q = query(collection(db, path), orderBy('order', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onData(
          DEFAULT_CATEGORY_SEEDS.map((c) => ({ ...c, id: c.slug })),
          true
        );
        return;
      }
      const list: CategoryRecord[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          name: typeof data.name === 'string' ? data.name : d.id,
          slug: typeof data.slug === 'string' ? data.slug : d.id,
          order: typeof data.order === 'number' ? data.order : 99,
          createdAt: toMillis(data.createdAt),
          updatedAt: toMillis(data.updatedAt),
        };
      });
      onData(list, false);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeGallery(
  onData: (items: GalleryItem[], isEmptyInDb: boolean) => void
): () => void {
  const path = 'gallery';
  const q = query(collection(db, path), orderBy('createdAt', 'asc'));
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) {
        onData(INITIAL_GALLERY_ITEMS, true);
        return;
      }
      const list: GalleryItem[] = snap.docs.map((d) => {
        const data = d.data();
        const spanVal =
          data.span === 'tall' || data.span === 'wide' ? data.span : 'standard';
        return {
          id: d.id,
          image: typeof data.image === 'string' ? data.image : '',
          caption: typeof data.caption === 'string' ? data.caption : '',
          date: typeof data.date === 'string' ? data.date : '',
          category: typeof data.category === 'string' ? data.category : '',
          span: spanVal,
          createdAt: toMillis(data.createdAt),
          updatedAt: toMillis(data.updatedAt),
        };
      });
      onData(list, false);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

/**
 * Member-only Personal Favorites (Pillar 8: query matches resource.data.userId == request.auth.uid)
 */
export function subscribeUserFavorites(
  uid: string,
  onData: (favoriteIds: string[]) => void
): () => void {
  const path = `users/${uid}/favorites`;
  const q = query(collection(db, path), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.id));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function toggleUserFavorite(
  uid: string,
  characterId: string,
  currentlyFavorited: boolean
): Promise<void> {
  const path = `users/${uid}/favorites/${characterId}`;
  const ref = doc(db, 'users', uid, 'favorites', characterId);
  try {
    if (currentlyFavorited) {
      await deleteDoc(ref);
    } else {
      await setDoc(ref, {
        userId: uid,
        characterId,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      currentlyFavorited ? OperationType.DELETE : OperationType.CREATE,
      path
    );
  }
}

/**
 * Username uniqueness check (non-PII /usernames/{username})
 */
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const clean = normalizeUsername(username);
  if (clean.length < 3) return false;
  const path = `usernames/${clean}`;
  try {
    const snap = await getDoc(doc(db, 'usernames', clean));
    return !snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

/**
 * Resolve verified role directly against trusted Firestore /admins & bootstrapped admin email
 */
export async function resolveServerAdminStatus(
  uid: string,
  email: string | null,
  emailVerified: boolean
): Promise<boolean> {
  if (!emailVerified) return false;
  if (email && email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()) {
    return true;
  }
  const path = `admins/${uid}`;
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

export async function syncUserProfileDoc(params: {
  uid: string;
  email: string;
  displayName: string;
  preferredUsername?: string;
  photoURL?: string;
  emailVerified: boolean;
}): Promise<UserProfile> {
  const isAdmin = await resolveServerAdminStatus(
    params.uid,
    params.email,
    params.emailVerified
  );

  // Unverified users keep read-only runtime state until email is verified
  if (!params.emailVerified) {
    return {
      uid: params.uid,
      displayName: params.displayName || 'Thành viên mới',
      username:
        normalizeUsername(params.preferredUsername || '') ||
        normalizeUsername(params.email.split('@')[0] || 'member') ||
        `user_${params.uid.slice(0, 6).toLowerCase()}`,
      email: params.email,
      role: 'user',
      photoURL: params.photoURL || '',
      emailVerified: false,
    };
  }

  const userPath = `users/${params.uid}`;
  const userRef = doc(db, 'users', params.uid);

  try {
    const existingSnap = await getDoc(userRef);
    if (existingSnap.exists()) {
      const data = existingSnap.data();
      const effectiveRole: 'user' | 'admin' = isAdmin ? 'admin' : 'user';
      // Keep role synced if bootstrapped admin signed in
      if (isAdmin && data.role !== 'admin') {
        await updateDoc(userRef, {
          role: 'admin',
          updatedAt: serverTimestamp(),
        });
      }
      const resolvedProfile: UserProfile = {
        uid: params.uid,
        displayName:
          typeof data.displayName === 'string'
            ? data.displayName
            : params.displayName,
        username:
          typeof data.username === 'string'
            ? data.username
            : `user_${params.uid.slice(0, 6).toLowerCase()}`,
        email: typeof data.email === 'string' ? data.email : params.email,
        role: effectiveRole,
        photoURL:
          typeof data.photoURL === 'string'
            ? data.photoURL
            : params.photoURL || '',
        emailVerified: true,
        createdAt: toMillis(data.createdAt),
        updatedAt: toMillis(data.updatedAt),
      };
      await ensurePublicProfileSynced(resolvedProfile);
      return resolvedProfile;
    }

    // Create new profile document with guaranteed safe username
    let candidateUsername =
      normalizeUsername(params.preferredUsername || '') ||
      normalizeUsername(params.email.split('@')[0] || '') ||
      `user_${params.uid.slice(0, 6).toLowerCase()}`;
    if (candidateUsername.length < 3) {
      candidateUsername = `${candidateUsername}_${params.uid.slice(0, 4).toLowerCase()}`;
    }

    const available = await checkUsernameAvailable(candidateUsername);
    const finalUsername = available
      ? candidateUsername
      : `${candidateUsername.slice(0, 24)}_${params.uid.slice(0, 5).toLowerCase()}`;

    const role: 'user' | 'admin' = isAdmin ? 'admin' : 'user';

    const profilePayload: Record<string, unknown> = {
      uid: params.uid,
      displayName: (params.displayName || finalUsername).slice(0, 80),
      username: finalUsername,
      email: params.email.slice(0, 160),
      role,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (params.photoURL) {
      profilePayload.photoURL = params.photoURL.slice(0, 250000);
    }

    await setDoc(userRef, profilePayload);

    try {
      await setDoc(doc(db, 'usernames', finalUsername), {
        uid: params.uid,
        username: finalUsername,
        createdAt: serverTimestamp(),
      });
    } catch {
      // Non-fatal if username reservation collides concurrently
    }

    const createdProfile: UserProfile = {
      uid: params.uid,
      displayName: String(profilePayload.displayName),
      username: finalUsername,
      email: params.email,
      role,
      photoURL: params.photoURL || '',
      emailVerified: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await ensurePublicProfileSynced(createdProfile);
    return createdProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, userPath);
  }
}

async function ensurePublicProfileSynced(profile: UserProfile): Promise<void> {
  const pubRef = doc(db, 'publicProfiles', profile.uid);
  try {
    const snap = await getDoc(pubRef);
    const safeName = profile.displayName.trim().slice(0, 80) || profile.username;
    const safePhoto = (profile.photoURL || '').slice(0, 250000);
    if (!snap.exists()) {
      await setDoc(pubRef, {
        uid: profile.uid,
        displayName: safeName,
        username: profile.username,
        photoURL: safePhoto,
        role: profile.role,
        updatedAt: serverTimestamp(),
      });
    } else {
      const existing = snap.data();
      const needsSync =
        existing.displayName !== safeName ||
        (existing.photoURL || '') !== safePhoto ||
        (profile.role === 'admin' && existing.role !== 'admin');
      if (needsSync) {
        const updateData: Record<string, unknown> = {
          displayName: safeName,
          photoURL: safePhoto,
          updatedAt: serverTimestamp(),
        };
        if (profile.role === 'admin' && existing.role !== 'admin') {
          updateData.role = 'admin';
        }
        await updateDoc(pubRef, updateData);
      }
    }
  } catch {
    // Non-fatal sync error; user can still continue normally
  }
}

/**
 * Allows the currently authenticated & verified user to update ONLY their own
 * displayName and avatar photoURL. Username, email, and role remain locked.
 */
export async function updateOwnProfile(params: {
  user: UserProfile;
  displayName: string;
  photoURL: string;
}): Promise<UserProfile> {
  const cleanName = params.displayName.trim().slice(0, 80);
  const cleanPhoto = params.photoURL.trim();

  if (!cleanName) {
    throw new Error('Vui lòng nhập tên hiển thị.');
  }
  if (cleanPhoto.length > 250000) {
    throw new Error('Ảnh đại diện vượt quá dung lượng cho phép.');
  }

  const fbUser = auth.currentUser;
  if (!fbUser || fbUser.uid !== params.user.uid) {
    throw new Error('Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.');
  }
  if (!fbUser.emailVerified) {
    throw new Error('Vui lòng xác minh email trước khi chỉnh sửa hồ sơ.');
  }

  const userPath = `users/${params.user.uid}`;
  try {
    await updateDoc(doc(db, 'users', params.user.uid), {
      displayName: cleanName,
      photoURL: cleanPhoto,
      updatedAt: serverTimestamp(),
    });

    const pubRef = doc(db, 'publicProfiles', params.user.uid);
    const pubSnap = await getDoc(pubRef);
    if (pubSnap.exists()) {
      await updateDoc(pubRef, {
        displayName: cleanName,
        photoURL: cleanPhoto,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(pubRef, {
        uid: params.user.uid,
        displayName: cleanName,
        username: params.user.username,
        photoURL: cleanPhoto,
        role: params.user.role,
        updatedAt: serverTimestamp(),
      });
    }

    try {
      const authUpdate: { displayName: string; photoURL?: string | null } = {
        displayName: cleanName,
      };
      if (cleanPhoto === '') {
        authUpdate.photoURL = '';
      } else if (
        (cleanPhoto.startsWith('https://') || cleanPhoto.startsWith('http://')) &&
        cleanPhoto.length <= 1000
      ) {
        authUpdate.photoURL = cleanPhoto;
      }
      await updateProfile(fbUser, authUpdate);
    } catch {
      // Non-fatal Firebase Auth display mirror error
    }

    return {
      ...params.user,
      displayName: cleanName,
      photoURL: cleanPhoto,
      updatedAt: Date.now(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

/**
 * ============================================================================
 * ADMIN-ONLY FIRESTORE MUTATIONS (Strictly enforced by firestore.rules!)
 * ============================================================================
 */

export async function seedInitialDatabase(adminUid: string): Promise<void> {
  const batch = writeBatch(db);

  DEFAULT_CATEGORY_SEEDS.forEach((cat) => {
    const ref = doc(db, 'categories', cat.slug);
    batch.set(ref, {
      name: cat.name.slice(0, 60),
      slug: cat.slug,
      order: cat.order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  INITIAL_CHARACTERS.forEach((char) => {
    const safeId = sanitizeRecordId(char.id);
    const ref = doc(db, 'characters', safeId);
    const payload: Record<string, unknown> = {
      id: safeId,
      name: char.name.slice(0, 120),
      image: char.image.slice(0, 250000),
      subtitle: char.subtitle.slice(0, 200),
      genre: char.genre.slice(0, 60),
      tags: char.tags.slice(0, 15).map((t) => t.slice(0, 40)),
      description: char.description.slice(0, 2000),
      plot: char.plot.slice(0, 15000),
      link: char.link.slice(0, 1000),
      pinned: Boolean(char.pinned),
      createdBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (char.linkLabel) {
      payload.linkLabel = char.linkLabel.slice(0, 60);
    }
    batch.set(ref, payload);
  });

  INITIAL_GALLERY_ITEMS.forEach((item) => {
    const ref = doc(db, 'gallery', item.id);
    batch.set(ref, {
      image: item.image.slice(0, 250000),
      caption: item.caption.slice(0, 200),
      date: item.date.slice(0, 60),
      category: item.category.slice(0, 80),
      span: item.span,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'characters');
  }
}

export async function saveCharacterAdmin(
  record: CharacterRecord,
  adminUid: string,
  isEditing: boolean,
  originalDocId?: string
): Promise<void> {
  const safeId = sanitizeRecordId(record.id);
  const path = `characters/${safeId}`;
  const cleanTags = record.tags
    .map((t) => t.trim().slice(0, 40))
    .filter(Boolean)
    .slice(0, 15);

  try {
    if (isEditing && originalDocId && originalDocId === safeId) {
      const ref = doc(db, 'characters', safeId);
      const existingSnap = await getDoc(ref);
      if (existingSnap.exists()) {
        const updatePayload: Record<string, unknown> = {
          id: safeId,
          name: record.name.trim().slice(0, 120),
          image: record.image.trim().slice(0, 250000),
          subtitle: record.subtitle.trim().slice(0, 200),
          genre: record.genre.trim().slice(0, 60) || 'Khác',
          tags: cleanTags,
          description: record.description.trim().slice(0, 2000),
          plot: record.plot.trim().slice(0, 15000),
          link: record.link.trim().slice(0, 1000),
          pinned: Boolean(record.pinned),
          updatedAt: serverTimestamp(),
        };
        if (record.linkLabel?.trim()) {
          updatePayload.linkLabel = record.linkLabel.trim().slice(0, 60);
        }
        await updateDoc(ref, updatePayload);
        return;
      }
    }

    const createPayload: Record<string, unknown> = {
      id: safeId,
      name: record.name.trim().slice(0, 120),
      image: record.image.trim().slice(0, 250000),
      subtitle: record.subtitle.trim().slice(0, 200),
      genre: record.genre.trim().slice(0, 60) || 'Khác',
      tags: cleanTags,
      description: record.description.trim().slice(0, 2000),
      plot: record.plot.trim().slice(0, 15000),
      link: record.link.trim().slice(0, 1000),
      pinned: Boolean(record.pinned),
      createdBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (record.linkLabel?.trim()) {
      createPayload.linkLabel = record.linkLabel.trim().slice(0, 60);
    }

    await setDoc(doc(db, 'characters', safeId), createPayload);

    if (isEditing && originalDocId && originalDocId !== safeId) {
      await deleteDoc(doc(db, 'characters', originalDocId));
    }
  } catch (error) {
    handleFirestoreError(
      error,
      isEditing ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function deleteCharacterAdmin(characterId: string): Promise<void> {
  const path = `characters/${characterId}`;
  try {
    await deleteDoc(doc(db, 'characters', characterId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function createCategoryAdmin(
  name: string,
  order: number
): Promise<void> {
  const cleanName = name.trim().slice(0, 60);
  const slug = slugifyVietnamese(cleanName);
  const path = `categories/${slug}`;
  try {
    await setDoc(doc(db, 'categories', slug), {
      name: cleanName,
      slug,
      order,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function renameCategoryAdmin(
  category: CategoryRecord,
  newName: string,
  affectedCharacters: CharacterRecord[]
): Promise<void> {
  const cleanName = newName.trim().slice(0, 60);
  const path = `categories/${category.id}`;
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'categories', category.id), {
      name: cleanName,
      updatedAt: serverTimestamp(),
    });

    for (const char of affectedCharacters) {
      const charRef = doc(db, 'characters', char.id);
      const snap = await getDoc(charRef);
      if (snap.exists()) {
        batch.update(charRef, {
          genre: cleanName,
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteCategoryAdmin(
  category: CategoryRecord,
  replacementGenre: string,
  affectedCharacters: CharacterRecord[]
): Promise<void> {
  const path = `categories/${category.id}`;
  const fallbackGenre = replacementGenre.trim().slice(0, 60) || 'Khác';
  try {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'categories', category.id));

    for (const char of affectedCharacters) {
      const charRef = doc(db, 'characters', char.id);
      const snap = await getDoc(charRef);
      if (snap.exists()) {
        batch.update(charRef, {
          genre: fallbackGenre,
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function addGalleryItemAdmin(item: GalleryItem): Promise<void> {
  const safeId = sanitizeRecordId(item.id);
  const path = `gallery/${safeId}`;
  try {
    await setDoc(doc(db, 'gallery', safeId), {
      image: item.image.trim().slice(0, 250000),
      caption: item.caption.trim().slice(0, 200),
      date: item.date.trim().slice(0, 60),
      category: item.category.trim().slice(0, 80),
      span: item.span,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteGalleryItemAdmin(itemId: string): Promise<void> {
  const path = `gallery/${itemId}`;
  try {
    await deleteDoc(doc(db, 'gallery', itemId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function fetchAllUsersAdmin(): Promise<UserProfile[]> {
  const path = 'users';
  try {
    const snap = await getDocs(collection(db, path));
    return snap.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        displayName:
          typeof data.displayName === 'string' ? data.displayName : 'Thành viên',
        username: typeof data.username === 'string' ? data.username : '',
        email: typeof data.email === 'string' ? data.email : '',
        role: data.role === 'admin' ? 'admin' : 'user',
        photoURL: typeof data.photoURL === 'string' ? data.photoURL : '',
        emailVerified: true,
        createdAt: toMillis(data.createdAt),
        updatedAt: toMillis(data.updatedAt),
      };
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function setUserRoleAdmin(
  targetUid: string,
  nextRole: 'user' | 'admin',
  actingAdminUid: string
): Promise<void> {
  const userPath = `users/${targetUid}`;
  try {
    if (nextRole === 'admin') {
      await setDoc(doc(db, 'admins', targetUid), {
        uid: targetUid,
        grantedBy: actingAdminUid,
        createdAt: serverTimestamp(),
      });
    } else {
      await deleteDoc(doc(db, 'admins', targetUid));
    }
    await updateDoc(doc(db, 'users', targetUid), {
      role: nextRole,
      updatedAt: serverTimestamp(),
    });
    try {
      const pubRef = doc(db, 'publicProfiles', targetUid);
      const pubSnap = await getDoc(pubRef);
      if (pubSnap.exists()) {
        await updateDoc(pubRef, {
          role: nextRole,
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Non-fatal if user has not created a publicProfile yet
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}
